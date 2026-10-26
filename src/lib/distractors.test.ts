import { describe, it, expect } from 'vitest';
import { pickDistractors, optionLabel } from './distractors';
import { createCard, type FlashCard } from './spaced-repetition';

const card = (word: string, english: string, wordType?: FlashCard['wordType']): FlashCard => ({
  ...createCard(word, english), wordType: wordType ?? null,
});

describe('pickDistractors', () => {
  const target = card('مَمْنُوع', 'forbidden', 'adjective');
  const pool = [
    target,
    card('كَبِير', 'big', 'adjective'),
    card('جَمِيل', 'beautiful', 'adjective'),
    card('سَعِيد', 'happy', 'adjective'),
    card('الكَتالانيّة', 'Catalan (the language)', 'noun'),
    card('وَثِقَ', 'to trust (in)', 'verb'),
  ];

  it('prefers words of the same kind', () => {
    const picks = pickDistractors(target, pool, 'english', 3, () => 0.5);
    expect(picks.sort()).toEqual(['beautiful', 'big', 'happy']);
  });

  it('falls back to other kinds when there are not enough', () => {
    const picks = pickDistractors(target, pool.slice(0, 3).concat(pool[4]), 'english', 3, () => 0.5);
    expect(picks).toHaveLength(3);
    expect(picks).toContain('Catalan (the language)');
  });

  it('never repeats the right answer or another option', () => {
    const dupes = [target, card('حَرَام', 'forbidden', 'adjective'), card('كَبِير', 'big', 'adjective'), card('عَظِيم', 'big', 'adjective')];
    const picks = pickDistractors(target, dupes, 'english', 3, () => 0.5);
    expect(picks).toEqual(['big']);
  });

  it('uses the "to …" shape when cards are untagged', () => {
    const verb = card('كَتَبَ', 'to write');
    const picks = pickDistractors(verb, [verb, card('a', 'to read'), card('b', 'book'), card('c', 'to go')], 'english', 2, () => 0.5);
    expect(picks.sort()).toEqual(['to go', 'to read']);
  });
});

describe('optionLabel', () => {
  it('drops a trailing register tag only', () => {
    expect(optionLabel('slowly, little by little (Shaami)')).toBe('slowly, little by little');
    expect(optionLabel('to trust (in)')).toBe('to trust (in)');
  });
});
