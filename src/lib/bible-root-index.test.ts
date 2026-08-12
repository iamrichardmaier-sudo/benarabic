import { describe, it, expect, beforeEach, vi } from 'vitest';

function queryStub(result: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    not: () => builder,
    limit: () => builder,
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const { fetchWordsByRoot } = await import('./bible-root-index');

beforeEach(() => {
  fromMock.mockReset();
});

describe('fetchWordsByRoot', () => {
  it('excludes the word being looked up from its own related list', async () => {
    fromMock.mockReturnValue(
      queryStub({
        data: [
          { surface: 'كَتَبَ', root: 'ك-ت-ب', lemma: 'كَتَبَ', pos: 'verb', verb_form: 'I', gloss: 'wrote' },
          { surface: 'كِتَاب', root: 'ك-ت-ب', lemma: 'كِتَاب', pos: 'noun', verb_form: null, gloss: 'book' },
        ],
        error: null,
      }),
    );

    const related = await fetchWordsByRoot('ك-ت-ب', 'كَتَبَ');
    expect(related.map((w) => w.surface)).toEqual(['كِتَاب']);
  });

  it('collapses multiple surface forms that share a lemma into one entry', async () => {
    fromMock.mockReturnValue(
      queryStub({
        data: [
          { surface: 'كِتَابٌ', root: 'ك-ت-ب', lemma: 'كِتَاب', pos: 'noun', verb_form: null, gloss: 'book' },
          { surface: 'كِتَابًا', root: 'ك-ت-ب', lemma: 'كِتَاب', pos: 'noun', verb_form: null, gloss: 'book' },
        ],
        error: null,
      }),
    );

    const related = await fetchWordsByRoot('ك-ت-ب', 'كَتَبَ');
    expect(related).toHaveLength(1);
  });

  it('caches results per root, so a second lookup does not re-query', async () => {
    fromMock.mockReturnValue(
      queryStub({
        data: [{ surface: 'قَرَأَ', root: 'ق-ر-أ', lemma: 'قَرَأَ', pos: 'verb', verb_form: 'I', gloss: 'read' }],
        error: null,
      }),
    );

    await fetchWordsByRoot('ق-ر-أ', 'x');
    fromMock.mockClear();
    await fetchWordsByRoot('ق-ر-أ', 'x');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns an empty list rather than throwing on a query error', async () => {
    fromMock.mockReturnValue(queryStub({ data: null, error: { message: 'network down' } }));
    const related = await fetchWordsByRoot('س-أ-ل', 'x');
    expect(related).toEqual([]);
  });
});
