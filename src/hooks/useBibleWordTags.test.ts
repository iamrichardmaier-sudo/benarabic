import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

/** A Supabase query builder stub: every chained call returns itself, and
 * the object is thenable so `await` resolves regardless of chain length. */
function queryStub(result: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    in: () => builder,
    not: () => builder,
    eq: () => builder,
    limit: () => builder,
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const { useBibleWordTags } = await import('./useBibleWordTags');

beforeEach(() => {
  fromMock.mockReset();
});

describe('useBibleWordTags', () => {
  it('looks up tags for the given surfaces and returns them keyed by surface', async () => {
    fromMock.mockReturnValue(
      queryStub({
        data: [
          { surface: 'قَالَ', root: 'ق-و-ل', lemma: 'قَالَ', pos: 'verb', verb_form: 'I', gloss: 'said' },
        ],
        error: null,
      }),
    );

    const { result } = renderHook(() => useBibleWordTags(['قَالَ', 'فِي']));

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.get('قَالَ')).toEqual({
      surface: 'قَالَ',
      root: 'ق-و-ل',
      lemma: 'قَالَ',
      pos: 'verb',
      verbForm: 'I',
      gloss: 'said',
    });
    expect(result.current.has('فِي')).toBe(false);
  });

  it('does not re-query a surface already resolved in a previous call', async () => {
    fromMock.mockReturnValue(
      queryStub({
        data: [{ surface: 'فَعَلَ', root: 'ف-ع-ل', lemma: 'فَعَلَ', pos: 'verb', verb_form: 'I', gloss: 'did' }],
        error: null,
      }),
    );

    const first = renderHook(() => useBibleWordTags(['فَعَلَ']));
    await waitFor(() => expect(first.result.current.size).toBe(1));

    fromMock.mockClear();
    const second = renderHook(() => useBibleWordTags(['فَعَلَ']));
    expect(second.result.current.get('فَعَلَ')?.gloss).toBe('did');
    expect(fromMock).not.toHaveBeenCalled();
  });
});
