import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const sampleIndex = {
  Matt: { '1': 'https://audio.example.com/matt-1.mp3', '2': 'https://audio.example.com/matt-2.mp3' },
};

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('useBibleAudio', () => {
  it('returns the chapter audio URL once the index has loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sampleIndex }));

    const { useBibleAudio } = await import('./useBibleAudio');
    const { result } = renderHook(() => useBibleAudio('Matt', 1));

    await waitFor(() => expect(result.current).toBe('https://audio.example.com/matt-1.mp3'));
  });

  it('returns null for a book/chapter with no audio yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sampleIndex }));

    const { useBibleAudio } = await import('./useBibleAudio');
    const { result } = renderHook(() => useBibleAudio('Gen', 1));

    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns null rather than throwing when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { useBibleAudio } = await import('./useBibleAudio');
    const { result } = renderHook(() => useBibleAudio('Matt', 1));

    expect(result.current).toBeNull();
  });

  it('returns null when book or chapter is not yet chosen', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sampleIndex }));

    const { useBibleAudio } = await import('./useBibleAudio');
    const { result } = renderHook(() => useBibleAudio(null, null));

    expect(result.current).toBeNull();
  });
});
