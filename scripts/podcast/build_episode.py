#!/usr/bin/env python3
"""Build a finished episode from ElevenLabs scene audio.

Expects the script's scenes generated one file per paragraph, which is what
the ElevenLabs reader produces: an odd-numbered file per `### Scene` heading
and an even-numbered file holding that scene's lines.

Lines are recovered from each scene file by aligning speech runs to script
lines with dynamic programming — fitting how long a line takes to how long it
is — because the silence between two lines is not reliably wider than the
silence inside one sentence, so splitting on gaps alone lands in the wrong
place about half the time.
"""
import argparse, json, re, subprocess, sys, tempfile
from pathlib import Path
import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SPOKEN = ('[EN]', '[SH]', '[FU]')
ARABIC = ('[SH]', '[FU]')


def ff(*args):
    return subprocess.run([FFMPEG, '-hide_banner', '-nostdin', '-y', *args],
                          capture_output=True, text=True)


def detect(path, noise='-42dB', d=0.25):
    err = ff('-i', str(path), '-af', f'silencedetect=noise={noise}:d={d}', '-f', 'null', '-').stderr
    starts = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err)
    total = int(m.group(1)) * 3600 + int(m.group(2)) * 60 + float(m.group(3))
    runs, cur = [], 0.0
    if ends and (not starts or ends[0] < starts[0]):
        cur = ends[0]
    for i, s in enumerate(starts):
        if s <= cur:
            continue
        runs.append((cur, s))
        cur = ends[i] if i < len(ends) else total
    if cur < total - 0.05:
        runs.append((cur, total))
    return runs, total


def align(path, lengths):
    """Give each line the consecutive runs whose total best matches its length."""
    runs, total = detect(path)
    n, m = len(lengths), len(runs)
    if m < n:
        return None, f'{m} runs for {n} lines'
    spoken = sum(b - a for a, b in runs)
    rate = sum(lengths) / spoken
    exp = [L / rate for L in lengths]
    dur = [b - a for a, b in runs]
    gap = [runs[j + 1][0] - runs[j][1] for j in range(m - 1)] + [0.0]

    INF = float('inf')
    dp = [[INF] * (m + 1) for _ in range(n + 1)]
    back = [[0] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0
    for i in range(1, n + 1):
        for j in range(i, m - (n - i) + 1):
            span = 0.0
            for k in range(j, i - 1, -1):
                span += dur[k - 1] + (gap[k - 1] if k < j else 0.0)
                prev = dp[i - 1][k - 1]
                if prev == INF:
                    continue
                c = prev + abs(span - exp[i - 1])
                if c < dp[i][j]:
                    dp[i][j], back[i][j] = c, k
    if dp[n][m] == INF:
        return None, 'no alignment'
    out, j = [], m
    for i in range(n, 0, -1):
        k = back[i][j]
        out.append((runs[k - 1][0], runs[j - 1][1]))
        j = k - 1
    return out[::-1], None


def parse(script: Path):
    """Scenes of (kind, length, pause-after), split into the two halves.

    The gap belongs to the line it follows, which is what makes the answer
    pause land after the prompt rather than after the model answer.
    """
    halves, cur, key = {'SH': [], 'FU': []}, None, 'SH'
    for line in script.read_text(encoding='utf-8').splitlines():
        if line.startswith('[[FUSHA START]]'):
            key = 'FU'
        elif line.startswith('### '):
            cur = []
            halves[key].append(cur)
        elif line[:4] in SPOKEN and cur is not None:
            cur.append([line[:4], len(line) - 5, 0.0])
        elif cur:
            m = re.match(r'\[PAUSE (\d+(?:\.\d+)?)\]', line)
            if m and cur:
                cur[-1][2] += float(m.group(1))
    return halves


def cut(src, a, b, dst, pad=0.06):
    ff('-i', str(src), '-ss', f'{max(a - pad, 0):.3f}', '-to', f'{b + pad:.3f}',
       '-c:a', 'libmp3lame', '-q:a', '3', str(dst))
    return dst


def silence(sec, dst):
    ff('-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', f'{sec:.3f}',
       '-c:a', 'libmp3lame', '-q:a', '6', str(dst))
    return dst


def dur_of(p):
    err = ff('-i', str(p)).stderr
    m = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err)
    return int(m.group(2)) * 60 + float(m.group(3))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script', type=Path)
    ap.add_argument('raw', type=Path, help='directory of 01.mp3 … 42.mp3')
    ap.add_argument('-o', '--out', type=Path, default=Path('episode.mp3'))
    ap.add_argument('--repeat', type=int, default=2)
    ap.add_argument('--gap', type=float, default=0.6, help='between repeats')
    ap.add_argument('--pause-scale', type=float, default=1.0)
    ap.add_argument('--lead', type=float, default=0.25, help='after every line')
    args = ap.parse_args()

    halves = parse(args.script)
    work = Path(tempfile.mkdtemp(prefix='wazn-ep-'))
    order, elapsed, fusha_at, report = [], 0.0, None, []

    def add(path):
        nonlocal elapsed
        order.append(path)
        elapsed += dur_of(path)

    def pause(sec):
        nonlocal elapsed
        order.append(silence(sec, work / f'p{len(order)}.mp3'))
        elapsed += sec

    plans = [('SH', halves['SH'], lambda k: (2 * k - 1, 2 * k), None),
             ('FU', halves['FU'], lambda k: (21 + 2 * k, 22 + 2 * k), 22)]

    for tag, scenes, files, part_heading in plans:
        if part_heading:
            fusha_at = elapsed
            add(args.raw / f'{part_heading:02d}.mp3')
            pause(0.8)
        for k, lines in enumerate(scenes, start=1):
            head, body = files(k)
            add(args.raw / f'{head:02d}.mp3')
            pause(0.6)
            bounds, err = align(args.raw / f'{body:02d}.mp3', [n for _, n, _ in lines])
            if err:
                sys.exit(f'{tag} scene {k} ({body:02d}.mp3): {err}')
            report.append((tag, k, body, len(bounds)))
            src = args.raw / f'{body:02d}.mp3'
            for idx, ((kind, _, after), (a, b)) in enumerate(zip(lines, bounds)):
                clip = cut(src, a, b, work / f'{tag}{k:02d}_{idx:03d}.mp3')
                times = args.repeat if kind in ARABIC else 1
                for r in range(times):
                    if r:
                        pause(args.gap)
                    add(clip)
                pause(args.lead + after * args.pause_scale)
            pause(1.0)

    listing = work / 'list.txt'
    listing.write_text(''.join(f"file '{p.resolve()}'\n" for p in order), encoding='utf-8')
    res = ff('-f', 'concat', '-safe', '0', '-i', str(listing),
             '-c:a', 'libmp3lame', '-q:a', '4', str(args.out))
    if res.returncode:
        sys.exit(res.stderr[-1200:])

    print(f'{args.out}  {elapsed/60:.1f} min')
    if fusha_at:
        print(f'Fusha begins at {int(fusha_at//60)}:{int(fusha_at%60):02d}')
    args.out.with_suffix('.json').write_text(json.dumps(
        {'duration': round(elapsed, 2), 'fushaStart': round(fusha_at or 0, 2),
         'scenes': [{'half': t, 'scene': k, 'file': f'{b:02d}.mp3', 'lines': n}
                    for t, k, b, n in report]}, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
