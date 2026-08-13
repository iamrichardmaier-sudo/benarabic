import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const sampleIndex = {
  علم: [
    { root: 'ع-ل-م', lemma: 'عَلِمَ', pos: 'verb', verbForm: 'I', gloss: 'he knew' },
    { root: 'ع-ل-م', lemma: 'عِلْم', pos: 'noun', verbForm: null, gloss: 'knowledge' },
  ],
  قال: [{ root: 'ق-و-ل', lemma: 'قَالَ', pos: 'verb', verbForm: 'I', gloss: 'he said' }],
};

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('useWordSkeletonIndex', () => {
  it('fetches the skeleton index and looks up a fully-voweled word by its consonant skeleton', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sampleIndex }));

    const { useWordSkeletonIndex } = await import('./useWordSkeletonIndex');
    const { result } = renderHook(() => useWordSkeletonIndex());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.lookup('قَالَ')).toEqual(sampleIndex['قال']);
  });

  it('returns every candidate sense for an ambiguous unvoweled skeleton', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sampleIndex }));

    const { useWordSkeletonIndex } = await import('./useWordSkeletonIndex');
    const { result } = renderHook(() => useWordSkeletonIndex());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.lookup('علم')).toHaveLength(2);
  });

  it('returns null for a word with no matching skeleton', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => sampleIndex }));

    const { useWordSkeletonIndex } = await import('./useWordSkeletonIndex');
    const { result } = renderHook(() => useWordSkeletonIndex());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.lookup('زرافة')).toBeNull();
  });

  it('surfaces an error rather than throwing when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const { useWordSkeletonIndex } = await import('./useWordSkeletonIndex');
    const { result } = renderHook(() => useWordSkeletonIndex());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.ready).toBe(false);
  });
});
