import { describe, it, expect } from 'vitest';
import { relatedInDeck, wordKey } from './word-relations';
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
