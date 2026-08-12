import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const sampleBooks = [
  { code: 'Gen', name: 'Genesis', order: 1, chapters: 50 },
  { code: 'Exod', name: 'Exodus', order: 2, chapters: 40 },
];

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('useBibleBooks', () => {
  it('fetches the book manifest from the base-url-relative path and returns it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleBooks,
    });
    vi.stubGlobal('fetch', fetchMock);

    const { useBibleBooks } = await import('./useBibleBooks');
    const { result } = renderHook(() => useBibleBooks());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.books).toEqual(sampleBooks));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('bible/books.json'));
  });

  it('surfaces an error message when the fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    const { useBibleBooks } = await import('./useBibleBooks');
    const { result } = renderHook(() => useBibleBooks());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.books).toBeNull();
  });
});
