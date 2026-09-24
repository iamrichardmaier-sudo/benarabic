#!/usr/bin/env python3
"""
Turn speech-only ElevenLabs audio into a finished Pimsleur-style episode.

Generate the cheap thing — the lines, no pauses, no break tags — and this puts
the lesson together around them: every Arabic line spoken twice, every answer
gap cut to the length the script asks for, and the whole thing written as one
MP3 with a chapter mark where Fusha begins.

Two ways to hand it the audio:

  --clips DIR   one file per spoken line, in script order. Exact, no guessing.
  --split PATH  a file, or a directory of files in order, holding runs of
                lines; cut apart on the silence between them. Generating one
                file per scene is the sane middle: twenty pastes rather than
                four hundred. The count is checked against the lines the
                script expects, and it refuses rather than misaligning.

Usage
  assemble.py script.md --clips audio/ -o episode.mp3
  assemble.py script.md --split scene1.mp3 --lines 1-24 -o scene1.mp3
  assemble.py script.md --clips audio/ --repeat 2 --gap 0.7 --pause-scale 1.4
"""
import argparse, json, re, subprocess, sys, tempfile
from pathlib import Path

import imageio_ffmpeg

FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
SPOKEN = ('[EN]', '[SH]', '[FU]')
ARABIC = ('[SH]', '[FU]')


def run(args, **kw):
    return subprocess.run([FFMPEG, '-hide_banner', '-nostdin', '-y', *args],
                          capture_output=True, text=True, **kw)


def parse_script(path: Path):
    """The script as an ordered list of spoken lines and gaps."""
    items, fusha_at = [], None
    for raw in path.read_text(encoding='utf-8').splitlines():
        line = raw.rstrip()
        if line.startswith('[[FUSHA START]]'):
            fusha_at = len(items)
        elif line[:4] in SPOKEN:
            items.append({'kind': line[:4], 'text': line[5:].strip()})
        else:
            m = re.match(r'\[PAUSE (\d+(?:\.\d+)?)\]', line)
            if m:
                items.append({'kind': 'PAUSE', 'seconds': float(m.group(1))})
    return items, fusha_at


def duration(path: Path) -> float:
    out = run(['-i', str(path)]).stderr
    m = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)', out)
    if not m:
        raise SystemExit(f'could not read the duration of {path}')
    h, mm, s = m.groups()
    return int(h) * 3600 + int(mm) * 60 + float(s)


def split_on_silence(src: Path, out_dir: Path, noise='-34dB', min_silence=0.32):
    """Cut a file wherever it goes quiet, and return the pieces in order."""
    log = run(['-i', str(src), '-af',
               f'silencedetect=noise={noise}:d={min_silence}', '-f', 'null', '-']).stderr
    starts = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)]
    total = duration(src)

    # Speech runs from the end of one silence to the start of the next.
    bounds, cursor = [], 0.0
    if ends and (not starts or ends[0] < starts[0]):
        cursor = ends[0]          # the file opens with silence
    for i, start in enumerate(starts):
        if start <= cursor:
            continue
        bounds.append((cursor, start))
        cursor = ends[i] if i < len(ends) else total
    if cursor < total - 0.05:
        bounds.append((cursor, total))

    out_dir.mkdir(parents=True, exist_ok=True)
    pieces = []
    for i, (a, b) in enumerate(bounds):
        dst = out_dir / f'{i:04d}.mp3'
        run(['-i', str(src), '-ss', f'{max(a - 0.06, 0):.3f}', '-to', f'{b + 0.12:.3f}',
             '-c:a', 'libmp3lame', '-q:a', '4', str(dst)])
        pieces.append(dst)
    return pieces


def silence(seconds: float, dst: Path):
    run(['-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', f'{seconds:.3f}',
         '-c:a', 'libmp3lame', '-q:a', '6', str(dst)])
    return dst


def build(items, clips, out: Path, repeat=2, gap=0.6, pause_scale=1.0, lead=0.25):
    """Lay the episode out: Arabic twice, gaps where the script asks for them."""
    spoken = [i for i in items if i['kind'] in SPOKEN]
    if len(clips) != len(spoken):
        raise SystemExit(
            f'{len(clips)} clips but {len(spoken)} spoken lines — refusing to guess.\n'
            f'Re-cut the audio, or pass --lines to assemble one stretch at a time.')

    work = Path(tempfile.mkdtemp(prefix='wazn-'))
    order, clip_at, marks, elapsed = [], 0, [], 0.0

    for item in items:
        if item['kind'] == 'PAUSE':
            seconds = item['seconds'] * pause_scale
            order.append(silence(seconds, work / f'gap{len(order)}.mp3'))
            elapsed += seconds
            continue
        clip = clips[clip_at]
        times = repeat if item['kind'] in ARABIC else 1
        for n in range(times):
            if n:
                order.append(silence(gap, work / f'rep{len(order)}.mp3'))
                elapsed += gap
            order.append(clip)
            elapsed += duration(clip)
        order.append(silence(lead, work / f'lead{len(order)}.mp3'))
        elapsed += lead
        clip_at += 1

    listing = work / 'list.txt'
    listing.write_text(''.join(f"file '{p.resolve()}'\n" for p in order), encoding='utf-8')
    res = run(['-f', 'concat', '-safe', '0', '-i', str(listing),
               '-c:a', 'libmp3lame', '-q:a', '4', str(out)])
    if res.returncode != 0:
        sys.exit(res.stderr[-1500:])
    return elapsed


def main():
    p = argparse.ArgumentParser()
    p.add_argument('script', type=Path)
    p.add_argument('--clips', type=Path, help='directory of one clip per spoken line')
    p.add_argument('--split', type=Path, help='one file to cut apart on silence')
    p.add_argument('--lines', help='restrict to spoken lines N-M, 1-based inclusive')
    p.add_argument('-o', '--out', type=Path, default=Path('episode.mp3'))
    p.add_argument('--repeat', type=int, default=2, help='times each Arabic line is said')
    p.add_argument('--gap', type=float, default=0.6, help='seconds between repeats')
    p.add_argument('--pause-scale', type=float, default=1.0, help='multiplies every [PAUSE]')
    p.add_argument('--noise', default='-34dB', help='silence threshold for --split')
    args = p.parse_args()

    items, fusha_at = parse_script(args.script)
    if args.lines:
        lo, hi = (int(x) for x in args.lines.split('-'))
        keep, seen = [], 0
        for item in items:
            if item['kind'] in SPOKEN:
                seen += 1
                if lo <= seen <= hi:
                    keep.append(item)
            elif keep and seen < hi:
                keep.append(item)
        items = keep

    if args.clips:
        clips = sorted(q for q in args.clips.iterdir() if q.suffix.lower() in ('.mp3', '.wav'))
    elif args.split:
        cut_dir = Path(tempfile.mkdtemp(prefix='wazn-cut-'))
        # A directory is taken in filename order, so scene files named 01, 02,
        # 03 rebuild the episode in the order they were generated.
        sources = (sorted(q for q in args.split.iterdir()
                          if q.suffix.lower() in ('.mp3', '.wav', '.m4a'))
                   if args.split.is_dir() else [args.split])
        clips = []
        for n, src in enumerate(sources):
            pieces = split_on_silence(src, cut_dir / f'{n:03d}', noise=args.noise)
            print(f'  {src.name}: {len(pieces)} lines')
            clips.extend(pieces)
        print(f'cut {len(clips)} pieces out of {len(sources)} file(s)')
    else:
        raise SystemExit('pass --clips or --split')

    total = build(items, clips, args.out, repeat=args.repeat, gap=args.gap,
                  pause_scale=args.pause_scale)
    spoken = sum(1 for i in items if i['kind'] in SPOKEN)
    print(f'{args.out}  {total/60:.1f} min  ({spoken} lines, Arabic ×{args.repeat})')
    if fusha_at is not None and not args.lines:
        print(f'Fusha begins at spoken line {sum(1 for i in items[:fusha_at] if i["kind"] in SPOKEN) + 1}')


if __name__ == '__main__':
    main()
