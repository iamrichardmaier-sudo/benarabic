import { describe, it, expect } from 'vitest';
import { buildDeckIndex, coverage, statusOf, vowelsDisagree } from './reader-status';
import type { FlashCard } from './spaced-repetition';

let n = 0;
const card = (fields: Partial<FlashCard>): FlashCard => ({
  id: `c${n++}`, word: '', english: null, imageUrl: null, nextReviewDate: '', intervalDays: 10,
  easeFactor: 2.5, learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0, ...fields,
});

const index = buildDeckIndex([
  card({ word: 'كِتاب', fushaPlural: 'كُتُب', root: 'ك-ت-ب' }),
  card({ word: 'قالَ', presentTense: 'يَقول', root: 'ق-و-ل', learningStage: 'stage1' }),
  card({ word: 'بَيت', root: 'ب-ي-ت', intensiveDay: 3 }),
  card({ word: 'في' }),
]);

describe('statusOf', () => {
  it('knows a word by its dictionary form, its plural, or as written with an article and ending', () => {
    expect(statusOf(index, { surface: 'كِتَابِهِمْ', lemma: 'كِتَاب', root: 'ك-ت-ب', pos: 'noun' })).toBe('known');
    expect(statusOf(index, { surface: 'الْكُتُبِ', lemma: null, root: 'ك-ت-ب', pos: 'noun' })).toBe('known');
    expect(statusOf(index, { surface: 'وَالْكِتَابَ' })).toBe('known');
  });

  it('calls a card still being learned, or in its first week, learning', () => {
    expect(statusOf(index, { surface: 'يَقُولُونَ', lemma: 'قالَ', pos: 'verb' })).toBe('learning');
    expect(statusOf(index, { surface: 'بَيْتِي', lemma: 'بَيْت', pos: 'noun' })).toBe('learning');
  });

  it('marks a new word on a held root apart from a wholly new one', () => {
    expect(statusOf(index, { surface: 'مَكْتُوب', lemma: 'مَكْتُوب', root: 'ك-ت-ب', pos: 'participle' })).toBe('root');
    expect(statusOf(index, { surface: 'شَجَرَة', lemma: 'شَجَرَة', root: 'ش-ج-ر', pos: 'noun' })).toBe('new');
  });

  it('does not count particles, names, or untagged words it cannot place', () => {
    expect(statusOf(index, { surface: 'ثُمَّ', lemma: 'ثُمَّ', pos: 'particle' })).toBe('none');
    expect(statusOf(index, { surface: 'يُوسُف', lemma: 'يُوسُف', pos: 'proper_noun' })).toBe('none');
    expect(statusOf(index, { surface: 'زمردة' })).toBe('none');
  });

  it('does not let a two-letter card claim longer words', () => {
    expect(statusOf(index, { surface: 'فِيهِمْ', lemma: 'فِيل', root: 'ف-ي-ل', pos: 'noun' })).toBe('new');
    expect(statusOf(index, { surface: 'فِي' })).toBe('known');
  });
});

describe('telling words with the same letters apart', () => {
  it('does not call the verb known because the plural noun is', () => {
    // The deck holds كُتُب (books), the plural of كِتاب, and not the verb كَتَبَ.
    expect(statusOf(index, { surface: 'كَتَبَ', lemma: 'كَتَبَ', root: 'ك-ت-ب', pos: 'verb' })).toBe('root');
    expect(statusOf(index, { surface: 'كتب', lemma: null, root: 'ك-ت-ب', pos: 'noun' })).toBe('known');
  });

  it('treats a missing vowel, a case ending and the article as no disagreement', () => {
    expect(vowelsDisagree('كِتاب', 'كِتَابُ')).toBe(false);
    expect(vowelsDisagree('كِتاب', 'الْكِتَابِ')).toBe(false);
    expect(vowelsDisagree('كُتُب', 'كَتَبَ')).toBe(true);
    expect(vowelsDisagree('عَلِمَ', 'عَلَّمَ')).toBe(true);
  });
});

describe('coverage', () => {
  it('counts every occurrence and leaves out what is not counted', () => {
    const c = coverage(['known', 'known', 'learning', 'root', 'new', 'none', 'none']);
    expect(c.counted).toBe(5);
    expect(c.share).toBeCloseTo(0.6);
    expect(coverage(['none']).share).toBeNull();
  });
});
