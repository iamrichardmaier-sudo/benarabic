import { describe, it, expect } from 'vitest';
import { MINIMAL_PAIRS, checkDictation, dictationDiff, dictationTarget } from './ear-training';
import { normalizeArabic } from './arabic-normalize';
import type { FlashCard } from './spaced-repetition';

const card = (fields: Partial<FlashCard>): FlashCard => ({
  id: 'c', word: '', english: null, imageUrl: null, nextReviewDate: '', intervalDays: 1,
  easeFactor: 2.5, learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0, ...fields,
});

describe('minimal pairs', () => {
  it('are two different words each, differing in spelling once vowels are gone or in a held sound', () => {
    for (const p of MINIMAL_PAIRS) {
      expect(p.a.ar).not.toBe(p.b.ar);
      expect(p.a.en && p.b.en).toBeTruthy();
    }
    // Outside the shadda pairs, the two must differ in their letters, not only their vowels.
    for (const p of MINIMAL_PAIRS.filter((x) => x.contrast !== 'doubled')) {
      expect(normalizeArabic(p.a.ar)).not.toBe(normalizeArabic(p.b.ar));
    }
  });
});

describe('dictation', () => {
  it('says the first spelling of a card and accepts it without vowels', () => {
    const t = dictationTarget(card({ word: 'نادي ج. نَوادي', wordVoweled: 'نادي' }));
    expect(t.say).toBe('نادي');
    expect(checkDictation('نادى', t.accept)).toBe(true);
    expect(checkDictation('نوادي', t.accept)).toBe(false);
  });

  it('does not grade the article, hamza seats or final punctuation', () => {
    const t = dictationTarget(card({ word: 'الأَرض' }));
    expect(checkDictation('ارض', t.accept)).toBe(true);
    expect(checkDictation('الارض.', t.accept)).toBe(true);
    expect(checkDictation('', t.accept)).toBe(false);
  });

  it('hears the difference the pairs train', () => {
    const t = dictationTarget(card({ word: 'قَلْب' }));
    expect(checkDictation('كلب', t.accept)).toBe(false);
  });

  it('names the words that were missed', () => {
    expect(dictationDiff('ذهب الى البيت', 'ذَهَبَ الوَلَدُ إِلى البَيتِ')).toEqual({ missing: ['الوَلَدُ'], extra: [] });
  });
});
