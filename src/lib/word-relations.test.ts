import { describe, it, expect } from 'vitest';
import { relatedInDeck, wordKey, visibleCompanions } from './word-relations';
import type { FlashCard } from './spaced-repetition';

function card(over: Partial<FlashCard> & { id: string; word: string }): FlashCard {
  return {
    english: null,
    imageUrl: null,
    nextReviewDate: '2026-01-01',
    intervalDays: 1,
    easeFactor: 2.5,
    learningStage: 'graduated',
    stage1Attempts: 0,
    stage2Attempts: 0,
    ...over,
  } as FlashCard;
}

describe('wordKey', () => {
  it('treats a vowelled and a bare spelling as the same word', () => {
    expect(wordKey('قَبْلَ')).toBe(wordKey('قبل'));
  });

  it('keys a two-spelling field on the first spelling', () => {
    expect(wordKey('طول / طِوال')).toBe(wordKey('طول'));
  });
});

describe('relatedInDeck', () => {
  const target = card({
    id: 'a',
    word: 'استقبل',
    wordVoweled: 'اِستَقبَلَ',
    english: 'to receive',
    root: 'ق-ب-ل',
    verbForm: 'X',
    companionForms: [{ form: 'قَبْلَ', label: 'Preposition (before)' }],
  });

  const deck = [
    target,
    card({ id: 'b', word: 'قبل', wordVoweled: 'قَبلَ', english: 'before', root: 'ق-ب-ل' }),
    card({ id: 'c', word: 'مستقبل', wordVoweled: 'مُستَقبَل', english: 'future', root: 'ق-ب-ل' }),
    card({ id: 'd', word: 'استخدم', wordVoweled: 'اِستَخدَمَ', english: 'to use', root: 'خ-د-م', verbForm: 'X' }),
    card({ id: 'e', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write', root: 'ك-ت-ب', verbForm: 'I' }),
  ];

  it('lists other deck words on the same root', () => {
    const { sameRoot } = relatedInDeck(target, deck);
    expect(sameRoot.map((w) => w.en)).toContain('future');
  });

  it('never lists the card itself', () => {
    const { sameRoot } = relatedInDeck(target, deck);
    expect(sameRoot.map((w) => w.ar)).not.toContain('اِستَقبَلَ');
  });

  it('skips a word already named among the companion forms', () => {
    // قَبلَ is in the deck on this root, but the card already spells it out as
    // a companion form, so repeating it under "same root" teaches nothing.
    const { sameRoot } = relatedInDeck(target, deck);
    expect(sameRoot.map((w) => w.en)).not.toContain('before');
  });

  it('lists other words in the same verb form', () => {
    const { sameForm } = relatedInDeck(target, deck);
    expect(sameForm.map((w) => w.en)).toEqual(['to use']);
  });

  it('does not repeat a word between the two lists', () => {
    const sameRootAndForm = card({
      id: 'f', word: 'استقر', wordVoweled: 'اِستَقَرَّ', english: 'to settle',
      root: 'ق-ب-ل', verbForm: 'X',
    });
    const { sameRoot, sameForm } = relatedInDeck(target, [...deck, sameRootAndForm]);
    const all = [...sameRoot, ...sameForm].map((w) => w.ar);
    expect(new Set(all).size).toBe(all.length);
  });

  it('returns nothing for a card with no root and no form', () => {
    const bare = card({ id: 'z', word: 'كَذلِكَ', english: 'likewise' });
    expect(relatedInDeck(bare, deck)).toEqual({ sameRoot: [], sameForm: [] });
  });
});

describe('visibleCompanions', () => {
  const cf = (form: string, label = 'l') => ({ form, label });

  it('drops a companion that repeats the masdar, article and all', () => {
    // الشُّكر under "Masdar" and شُكر under "Word family" is the same word twice.
    expect(visibleCompanions([cf('شُكر'), cf('شاكِر')], 'يَشكُر', ['الشُّكر']))
      .toEqual([cf('شاكِر')]);
  });

  it('drops a companion that repeats the plural', () => {
    expect(visibleCompanions([cf('وُعود'), cf('وَعَدَ')], 'وَعد', ['وُعود']))
      .toEqual([cf('وَعَدَ')]);
  });

  it('drops a companion that repeats the Shaami row', () => {
    expect(visibleCompanions([cf('كَمان'), cf('أَيضاً')], 'كَذلِكَ', ['كَمان']))
      .toEqual([cf('أَيضاً')]);
  });

  it('keeps a participle pair that differs only in a vowel', () => {
    // مُلهِم (inspiring) and مُلهَم (inspired) share a skeleton, and teaching
    // that contrast is the whole point of the section.
    expect(visibleCompanions([cf('مُلهِم'), cf('مُلهَم')], 'إلهام', [])).toHaveLength(2);
  });

  it('keeps a verb beside its noun headword', () => {
    // صَبر and صَبَرَ share a skeleton but are different words.
    expect(visibleCompanions([cf('صَبَرَ')], 'صَبر', [])).toEqual([cf('صَبَرَ')]);
  });

  it('drops a companion identical to the headword', () => {
    expect(visibleCompanions([cf('صَبر'), cf('صابِر')], 'صَبر', [])).toEqual([cf('صابِر')]);
  });

  it('drops an exact repeat within the companions', () => {
    expect(visibleCompanions([cf('عادَ'), cf('عادَ')], 'يُعيد', [])).toHaveLength(1);
  });

  it('ignores blank rows rather than dropping everything', () => {
    expect(visibleCompanions([cf('شاكِر')], 'يَشكُر', [null, undefined, '']))
      .toEqual([cf('شاكِر')]);
  });
});
