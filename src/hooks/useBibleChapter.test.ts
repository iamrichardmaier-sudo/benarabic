import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const genesis1 = [{ v: 1, a: 'فِي الْبَدْءِ', e: 'In the beginning' }];

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('useBibleChapter', () => {
  it('fetches the requested book and chapter', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => genesis1 });
    vi.stubGlobal('fetch', fetchMock);

    const { useBibleChapter } = await import('./useBibleChapter');
    const { result } = renderHook(() => useBibleChapter('Gen', 1));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.verses).toEqual(genesis1));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('bible/Gen/1.json'));
  });

  it('does nothing when book or chapter is not chosen yet', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { useBibleChapter } = await import('./useBibleChapter');
    const { result } = renderHook(() => useBibleChapter(null, null));
    expect(result.current.loading).toBe(false);
    expect(result.current.verses).toBeNull();
  });

  it('does not re-fetch a chapter that was already loaded', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => genesis1 });
    vi.stubGlobal('fetch', fetchMock);

    const { useBibleChapter } = await import('./useBibleChapter');
    const first = renderHook(() => useBibleChapter('Gen', 1));
    await waitFor(() => expect(first.result.current.verses).toEqual(genesis1));

    const second = renderHook(() => useBibleChapter('Gen', 1));
    expect(second.result.current.verses).toEqual(genesis1);
    expect(second.result.current.loading).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
