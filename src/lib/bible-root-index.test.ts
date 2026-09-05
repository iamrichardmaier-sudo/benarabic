import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

function queryStub(result: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    not: () => builder,
    order: () => builder,
    limit: () => builder,
    then: (resolve: (v: typeof result) => void) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const fromMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const { fetchWordsByRoot, splitRootSense } = await import('./bible-root-index');

beforeEach(() => {
  fromMock.mockReset();
});

// The module caches per root, so each case uses its own — otherwise the
// second lookup would be answered from the first one's result.
const entry = (lemma: string, gloss: string, root = 'ك-ت-ب') => ({
  lemma, root, pos: 'noun', verb_form: null, glosses: [gloss],
});

describe('fetchWordsByRoot', () => {
  it('reads the family from the dictionary, not the tag table', async () => {
    // bible_word_tags holds one row per spelling and four fifths of the Book
    // of Mormon rows have no gloss, so asking it for a root returns a column
    // of bare Arabic. Every dictionary row has a meaning by construction.
    fromMock.mockReturnValue(queryStub({ data: [entry('كِتاب', 'book')], error: null }));
    await fetchWordsByRoot('ك-ت-ب', 'x');
    expect(fromMock).toHaveBeenCalledWith('dictionary');
  });

  it('gives every word in the family a meaning', async () => {
    fromMock.mockReturnValue(
      queryStub({
        data: [entry('دَرْس', 'lesson', 'د-ر-س'), entry('مُدَرِّس', 'teacher', 'د-ر-س')],
        error: null,
      }),
    );
    const family = await fetchWordsByRoot('د-ر-س', 'x');
    expect(family.map((w) => w.gloss)).toEqual(['lesson', 'teacher']);
  });

  it('excludes the word being looked up even when it is spelt differently', async () => {
    // The reader taps an inflected surface (الْكِتابُ); the dictionary holds
    // the bare lemma. Comparing the two literally would list the word inside
    // its own family.
    fromMock.mockReturnValue(
      queryStub({
        data: [entry('كِتاب', 'book', 'ك-ت-ب-2'), entry('كاتِب', 'writer', 'ك-ت-ب-2')],
        error: null,
      }),
    );
    const family = await fetchWordsByRoot('ك-ت-ب-2', 'الْكِتابُ');
    expect(family.map((w) => w.lemma)).toEqual(['كاتِب']);
  });

  it('keeps a relative whose alef is part of the word, not an article', async () => {
    // إِلٰه carries a vowel on its hamza; reading it as "the ـله" would drop a
    // genuine family member from the list.
    fromMock.mockReturnValue(
      queryStub({ data: [entry('إِلٰه', 'god', 'ء-ل-ه')], error: null }),
    );
    const family = await fetchWordsByRoot('ء-ل-ه', 'لٰه');
    expect(family.map((w) => w.lemma)).toEqual(['إِلٰه']);
  });

  it('lists a word once even when the dictionary spells it two ways', async () => {
    // رَبّ and رَبٌّ are one word with two tashkeel patterns, both "Lord".
    fromMock.mockReturnValue(
      queryStub({
        data: [entry('رَبّ', 'Lord', 'ر-ب-ب'), entry('رَبٌّ', 'Lord', 'ر-ب-ب')],
        error: null,
      }),
    );
    expect(await fetchWordsByRoot('ر-ب-ب', 'x')).toHaveLength(1);
  });

  it('caches results per root, so a second lookup does not re-query', async () => {
    fromMock.mockReturnValue(
      queryStub({ data: [{ lemma: 'قَرَأَ', root: 'ق-ر-أ', pos: 'verb', verb_form: 'I', glosses: ['read'] }], error: null }),
    );
    await fetchWordsByRoot('ق-ر-أ', 'x');
    fromMock.mockClear();
    await fetchWordsByRoot('ق-ر-أ', 'x');
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns an empty list rather than throwing on a query error', async () => {
    fromMock.mockReturnValue(queryStub({ data: null, error: { message: 'network down' } }));
    expect(await fetchWordsByRoot('س-أ-ل', 'x')).toEqual([]);
  });
});

describe('splitRootSense', () => {
  const w = (lemma: string, gloss: string | null): BibleWordTag =>
    ({ surface: lemma, lemma, root: 'ك-ت-ب', pos: null, verbForm: null, gloss });

  it('leads a gloss-less word with the commonest word on its root', () => {
    // كَلِماتِهِ carries a root and nothing else. Showing its heading over a
    // blank taught nothing; showing كَلِمَة "word" tells the reader what they
    // are looking at.
    const { rootSense, family } = splitRootSense(null, [w('كَلِمَة', 'word'), w('كَلام', 'speech')]);
    expect(rootSense?.lemma).toBe('كَلِمَة');
    expect(family.map((f) => f.lemma)).toEqual(['كَلام']);
  });

  it('does not repeat the stand-in further down the list', () => {
    const { rootSense, family } = splitRootSense(null, [w('كِتاب', 'book')]);
    expect(rootSense?.lemma).toBe('كِتاب');
    expect(family).toEqual([]);
  });

  it('keeps the whole family as a list when the word glosses itself', () => {
    const { rootSense, family } = splitRootSense('he wrote', [w('كِتاب', 'book')]);
    expect(rootSense).toBeNull();
    expect(family).toHaveLength(1);
  });

  it('never offers a stand-in that has no meaning of its own', () => {
    expect(splitRootSense(null, [w('كِتاب', null)]).rootSense).toBeNull();
  });

  it('copes with the family not having loaded yet', () => {
    expect(splitRootSense(null, null)).toEqual({ rootSense: null, family: [] });
  });

  it('prefers the relative spelt like the word, not merely the commonest', () => {
    // On س-م-و the commonest word in the corpus is اِسْم "name". Ordering by
    // frequency alone would gloss السَماءِ "the heaven" as "name".
    const { rootSense } = splitRootSense(
      null,
      [w('اِسْم', 'name'), w('سَماء', 'heaven, sky')],
      'السَماءِ',
    );
    expect(rootSense?.lemma).toBe('سَماء');
  });

  it('falls back to the commonest when nothing is spelt alike', () => {
    const { rootSense } = splitRootSense(null, [w('كَثير', 'many'), w('كَثْرَة', 'abundance')], 'أَكْثَرَ');
    expect(rootSense?.lemma).toBe('كَثير');
  });

  it('drops the chosen stand-in from the list wherever it sat', () => {
    const { family } = splitRootSense(
      null,
      [w('اِسْم', 'name'), w('سَماء', 'heaven'), w('سَماوِيّ', 'heavenly')],
      'السَماءِ',
    );
    expect(family.map((f) => f.lemma)).toEqual(['اِسْم', 'سَماوِيّ']);
  });
});
