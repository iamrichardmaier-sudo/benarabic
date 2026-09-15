import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invokeMock(...args) } },
}));

import { wordsNeedingTags, tagWords, MAX_WORDS } from './tag-text';
import { skeletonOf } from '@/hooks/useWordSkeletonIndex';

beforeEach(() => invokeMock.mockReset());

const nothingCovered = () => false;

describe('wordsNeedingTags', () => {
  it('picks the distinct words out of a text', () => {
    const got = wordsNeedingTags('اصحى وركز، اصحى', nothingCovered);
    expect(got.map((w) => w.word)).toEqual(['اصحى', 'وركز']);
  });

  it('strips the punctuation clinging to a word', () => {
    expect(wordsNeedingTags('«بعيد»؟', nothingCovered)[0].word).toBe('بعيد');
  });

  it('treats two spellings of one word as one', () => {
    // Voweled and bare share a consonant skeleton, which is what the reader
    // looks up by, so tagging both would be tagging the same word twice.
    const got = wordsNeedingTags('خِدمة خدمة', nothingCovered);
    expect(got).toHaveLength(1);
  });

  it('leaves alone what the shared index already explains', () => {
    const known = skeletonOf('قال');
    const got = wordsNeedingTags('قال بعيد', (s) => s === known);
    expect(got.map((w) => w.word)).toEqual(['بعيد']);
  });

  it('keys each word by its skeleton', () => {
    expect(wordsNeedingTags('بعيد', nothingCovered)[0].skeleton).toBe(skeletonOf('بعيد'));
  });
});

describe('tagWords', () => {
  const word = { skeleton: skeletonOf('اصحى'), word: 'اصحى' };

  it('keeps everything the tagger found, not just the headline', async () => {
    // The panel the reader shows is the flashcard's panel, so it has a plural
    // row, a verb's principal parts and a word family to fill. Dropping those
    // on the way in is what left the popover with a heading and a gloss.
    invokeMock.mockResolvedValue({
      data: {
        results: [
          {
            id: word.skeleton,
            gloss: 'to wake up',
            root: 'ص-ح-و',
            wordType: 'verb',
            verbForm: 'I',
            wordVoweled: 'اِصْحى',
            gender: null,
            fushaPlural: null,
            pastTense: 'صَحا',
            presentTense: 'يَصحو',
            masdarForm: 'صَحْو',
            companionForms: [{ form: 'صاحٍ', label: 'Active participle' }],
          },
        ],
      },
      error: null,
    });

    const tags = await tagWords([word]);
    expect(tags[word.skeleton]).toEqual([
      {
        word: 'اِصْحى',
        english: 'to wake up',
        root: 'ص-ح-و',
        wordType: 'verb',
        verbForm: 'I',
        gender: null,
        fushaPlural: null,
        pastTense: 'صَحا',
        presentTense: 'يَصحو',
        masdarForm: 'صَحْو',
        companionForms: [{ form: 'صاحٍ', label: 'Active participle' }],
      },
    ]);
  });

  it('drops a word it learned nothing about', async () => {
    // A heading with no meaning under it is worse than no popover at all.
    invokeMock.mockResolvedValue({
      data: { results: [{ id: word.skeleton, gloss: null, root: null, wordType: 'other' }] },
      error: null,
    });
    expect(await tagWords([word])).toEqual({});
  });

  it('keeps the batches that worked when one fails', async () => {
    const many = Array.from({ length: 24 }, (_, i) => ({ skeleton: `s${i}`, word: `w${i}` }));
    invokeMock
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({
        data: { results: [{ id: 's12', gloss: 'a word', root: null, wordType: 'noun', wordVoweled: 'w12' }] },
        error: null,
      });

    const tags = await tagWords(many);
    // A partly-tagged text is useful; refusing to save over one timeout is not.
    expect(Object.keys(tags)).toEqual(['s12']);
  });

  it('reports progress so a slow save can say what it is doing', async () => {
    invokeMock.mockResolvedValue({ data: { results: [] }, error: null });
    const seen: string[] = [];
    await tagWords(
      Array.from({ length: 20 }, (_, i) => ({ skeleton: `s${i}`, word: `w${i}` })),
      (p) => seen.push(`${p.done}/${p.total}`),
    );
    expect(seen[0]).toBe('0/20');
    expect(seen[seen.length - 1]).toBe('20/20');
  });

  it('stops at the ceiling rather than tagging a whole book', async () => {
    invokeMock.mockResolvedValue({ data: { results: [] }, error: null });
    const huge = Array.from({ length: MAX_WORDS + 60 }, (_, i) => ({ skeleton: `s${i}`, word: `w${i}` }));
    const last: string[] = [];
    await tagWords(huge, (p) => last.push(`${p.done}/${p.total}`));
    expect(last[last.length - 1]).toBe(`${MAX_WORDS}/${MAX_WORDS}`);
  });

  it('sends the words keyed by skeleton, so results can be matched back', async () => {
    invokeMock.mockResolvedValue({ data: { results: [] }, error: null });
    await tagWords([word]);
    expect(invokeMock).toHaveBeenCalledWith('tag-word', {
      body: { words: [{ id: word.skeleton, fusha: 'اصحى' }] },
    });
  });
});
