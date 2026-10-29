import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { isVideo } from '@/lib/daily-audio';
import { useDailyAudios, parseManifest, splitEpisodes, isChapterAudio, isAkAudio, MANIFEST_URL, type DailyAudio } from './useDailyAudios';

const manifest = {
  version: 1,
  updated: '2026-10-07T07:10:00-06:00',
  episodes: [
    {
      id: '2026-10-07',
      date: '2026-10-07',
      title: 'Oct 7 — الهجرة · Migration',
      audio_url: 'https://iamrichardmaier-sudo.github.io/wazn-daily-audio/audio/2026-10-07.mp3',
      image_url: 'https://iamrichardmaier-sudo.github.io/wazn-daily-audio/art/2026-10-07.png',
      duration_secs: 330,
    },
    {
      id: '2026-10-08-chapter-ii',
      date: '2026-10-08',
      title: 'Oct 8 — Chapter II - Audio Exercises',
      audio_url: 'https://iamrichardmaier-sudo.github.io/wazn-daily-audio/audio/2026-10-08-chapter-ii.mp3',
      image_url: null,
      duration_secs: 600,
    },
  ],
};

const reply = (body: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: async () => body });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('useDailyAudios', () => {
  it('reads the GitHub Pages manifest and maps the episodes', async () => {
    const fetchMock = reply(manifest);
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDailyAudios());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    // no-store: GitHub Pages' 10-minute max-age would hide a new episode.
    expect(fetchMock).toHaveBeenCalledWith(MANIFEST_URL, { cache: 'no-store' });
    expect(MANIFEST_URL).toBe('https://iamrichardmaier-sudo.github.io/wazn-daily-audio/episodes.json');
    expect(result.current.daily).toEqual([
      {
        id: '2026-10-07',
        audioDate: '2026-10-07',
        title: 'Oct 7 — الهجرة · Migration',
        audioUrl: 'https://iamrichardmaier-sudo.github.io/wazn-daily-audio/audio/2026-10-07.mp3',
        imageUrl: 'https://iamrichardmaier-sudo.github.io/wazn-daily-audio/art/2026-10-07.png',
        durationSecs: 330,
        collection: null,
      },
    ]);
    expect(result.current.chapters.map((e) => e.id)).toEqual(['2026-10-08-chapter-ii']);
    expect(result.current.error).toBeNull();
  });

  it('returns an empty list, not an error, for a manifest with no episodes yet', async () => {
    vi.stubGlobal('fetch', reply({ version: 1, episodes: [] }));
    const { result } = renderHook(() => useDailyAudios());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.daily).toEqual([]);
    expect(result.current.chapters).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('reports an error when the manifest cannot be fetched', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({}, false, 404));
    const { result } = renderHook(() => useDailyAudios());
    await waitFor(() => expect(result.current.error).toMatch(/404/));
    expect(result.current.loading).toBe(false);
    expect(result.current.daily).toEqual([]);
    expect(result.current.chapters).toEqual([]);
  });

  it('reports an error when the request itself fails (offline)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const { result } = renderHook(() => useDailyAudios());
    await waitFor(() => expect(result.current.error).toBe('Failed to fetch'));
    expect(result.current.loading).toBe(false);
  });

  it('reports an error when the JSON is not a manifest', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', reply({ oops: true }));
    const { result } = renderHook(() => useDailyAudios());
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.daily).toEqual([]);
  });
});

describe('parseManifest', () => {
  const ep = (date: string, extra: Record<string, unknown> = {}) => ({
    id: date, date, title: `T ${date}`, audio_url: `https://x/${date}.mp3`, ...extra,
  });

  it('keeps every episode, newest first', () => {
    const days = Array.from({ length: 20 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`);
    const out = parseManifest({ episodes: days.map((d) => ep(d)) });
    expect(out).toHaveLength(20);
    expect(out[0].audioDate).toBe('2026-09-20');
    expect(out[19].audioDate).toBe('2026-09-01');
  });

  it('drops entries that cannot be played and tolerates missing optional fields', () => {
    const out = parseManifest({
      episodes: [
        ep('2026-10-01'),
        { id: 'x', date: '2026-10-02', title: 'no audio' },
        null,
        'junk',
        ep('2026-10-03', { image_url: '', duration_secs: 'long' }),
      ],
    });
    expect(out.map((e) => e.audioDate)).toEqual(['2026-10-03', '2026-10-01']);
    expect(out[0].imageUrl).toBeNull();
    expect(out[0].durationSecs).toBeNull();
  });

  it('falls back to the date when an entry has no id', () => {
    const out = parseManifest({ episodes: [{ date: '2026-10-01', title: 't', audio_url: 'https://x/a.mp3' }] });
    expect(out[0].id).toBe('2026-10-01');
  });
});

describe('splitEpisodes', () => {
  const ep = (id: string, audioDate: string, collection: string | null = null): DailyAudio => ({
    id, audioDate, title: `T ${id}`, audioUrl: `https://x/${id}.mp3`, imageUrl: null, durationSecs: null, collection,
  });

  it('recognises a chapter audio by its id, whatever the case or chapter', () => {
    expect(isChapterAudio(ep('2026-10-08-chapter-ii', '2026-10-08'))).toBe(true);
    expect(isChapterAudio(ep('2026-11-02-Chapter-III', '2026-11-02'))).toBe(true);
    expect(isChapterAudio(ep('CHAPTER-12', '2026-12-01'))).toBe(true);
    expect(isChapterAudio(ep('2026-10-08', '2026-10-08'))).toBe(false);
  });

  it('keeps chapter audios out of the daily shelf and puts them on their own', () => {
    const { daily, chapters } = splitEpisodes([
      ep('2026-10-09', '2026-10-09'),
      ep('2026-10-08-chapter-ii', '2026-10-08'),
      ep('2026-10-08', '2026-10-08'),
    ]);
    expect(daily.map((e) => e.id)).toEqual(['2026-10-09', '2026-10-08']);
    expect(chapters.map((e) => e.id)).toEqual(['2026-10-08-chapter-ii']);
  });

  it('caps the daily shelf at 14, counting only daily episodes, and lists every chapter', () => {
    const days = Array.from({ length: 20 }, (_, i) => `2026-09-${String(20 - i).padStart(2, '0')}`);
    const all = [
      ...days.map((d) => ep(d, d)),
      ...days.map((d) => ep(`${d}-chapter-${d.slice(-2)}`, d)),
    ].sort((a, b) => b.audioDate.localeCompare(a.audioDate));
    const { daily, chapters } = splitEpisodes(all);
    expect(daily).toHaveLength(14);
    expect(daily.every((e) => !isChapterAudio(e))).toBe(true);
    expect(daily[0].id).toBe('2026-09-20');
    expect(daily[13].id).toBe('2026-09-07');
    expect(chapters).toHaveLength(20);
    expect(chapters[0].id).toBe('2026-09-20-chapter-20');
  });

  it('puts collection "ak" episodes on the AK II shelf, whatever their id', () => {
    expect(isAkAudio(ep('2026-10-13-maha-qissa', '2026-10-13', 'ak'))).toBe(true);
    expect(isAkAudio(ep('2026-10-13-maha-qissa', '2026-10-13', 'AK'))).toBe(true);
    expect(isAkAudio(ep('2026-10-13', '2026-10-13', null))).toBe(false);
    const { daily, chapters } = splitEpisodes([
      ep('2026-10-13', '2026-10-13'),
      ep('2026-10-13-maha-qissa', '2026-10-13', 'ak'),
      ep('2026-10-08-chapter-ii', '2026-10-08'),
    ]);
    expect(daily.map((e) => e.id)).toEqual(['2026-10-13']);
    expect(chapters.map((e) => e.id)).toEqual(['2026-10-13-maha-qissa', '2026-10-08-chapter-ii']);
  });
});

describe('video episodes', () => {
  const base = { id: '2026-10-20-souq', date: '2026-10-20', title: 'Oct 20 — At the Souq' };

  it('reads an entry with media_type "video" as a video item', () => {
    const [e] = parseManifest({
      episodes: [{
        ...base,
        media_type: 'video',
        video_url: 'https://x/video/souq.mp4',
        audio_url: 'https://x/audio/souq.mp3',
        image_url: 'https://x/art/souq.png',
        duration_secs: 420,
      }],
    });
    expect(e).toEqual({
      id: '2026-10-20-souq',
      audioDate: '2026-10-20',
      title: 'Oct 20 — At the Souq',
      audioUrl: 'https://x/audio/souq.mp3',
      imageUrl: 'https://x/art/souq.png',
      durationSecs: 420,
      collection: null,
      mediaType: 'video',
      videoUrl: 'https://x/video/souq.mp4',
    });
    expect(isVideo(e)).toBe(true);
  });

  it('treats a video_url alone as a video, listened to from the video file itself', () => {
    const [e] = parseManifest({ episodes: [{ ...base, video_url: 'https://x/video/souq.mp4' }] });
    expect(e.mediaType).toBe('video');
    expect(e.videoUrl).toBe('https://x/video/souq.mp4');
    expect(e.audioUrl).toBe('https://x/video/souq.mp4');
  });

  it('accepts media_type "video" whose only file is audio_url', () => {
    const [e] = parseManifest({ episodes: [{ ...base, media_type: 'Video', audio_url: 'https://x/souq.mp4' }] });
    expect(e.mediaType).toBe('video');
    expect(e.videoUrl).toBe('https://x/souq.mp4');
  });

  it('drops a video entry with no file at all', () => {
    expect(parseManifest({ episodes: [{ ...base, media_type: 'video' }] })).toEqual([]);
  });

  it('leaves audio entries without the new fields exactly as before', () => {
    const out = parseManifest(manifest);
    for (const e of out) {
      expect(Object.keys(e).sort()).toEqual(
        ['audioDate', 'audioUrl', 'collection', 'durationSecs', 'id', 'imageUrl', 'title'],
      );
      expect(isVideo(e)).toBe(false);
    }
    // media_type "audio" is still plain audio.
    const [plain] = parseManifest({ episodes: [{ ...base, media_type: 'audio', audio_url: 'https://x/a.mp3' }] });
    expect('mediaType' in plain).toBe(false);
    expect('videoUrl' in plain).toBe(false);
  });

  it('routes videos to the shelves by the same collection and id rules', () => {
    const v = (id: string, extra: Record<string, unknown> = {}) => ({
      id, date: '2026-10-20', title: id, video_url: `https://x/${id}.mp4`, ...extra,
    });
    const { daily, chapters } = splitEpisodes(parseManifest({
      episodes: [
        v('2026-10-20-souq'),
        v('2026-10-20-chapter-iii'),
        v('2026-10-20-maha-qissa', { collection: 'AK' }),
        { id: '2026-10-19', date: '2026-10-19', title: 'audio', audio_url: 'https://x/a.mp3' },
      ],
    }));
    expect(daily.map((e) => e.id)).toEqual(['2026-10-20-souq', '2026-10-19']);
    expect(chapters.map((e) => e.id).sort()).toEqual(['2026-10-20-chapter-iii', '2026-10-20-maha-qissa']);
    expect(chapters.every(isVideo)).toBe(true);
  });
});
