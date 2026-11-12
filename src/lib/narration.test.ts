import { describe, expect, it } from 'vitest';
import { wordAt } from './narration';

const words = [
  { i: 0, s: 0.0, e: 0.4 },
  { i: 1, s: 0.5, e: 1.0 },
  { i: 2, s: 3.0, e: 3.5 },
];

describe('wordAt', () => {
  it('finds the word being said', () => {
    expect(wordAt(words, 0.2)).toBe(0);
    expect(wordAt(words, 0.7)).toBe(1);
    expect(wordAt(words, 3.2)).toBe(2);
  });
  it('holds a word through a short pause, not a long one', () => {
    expect(wordAt(words, 0.45)).toBe(0);
    expect(wordAt(words, 1.4)).toBe(1);
    expect(wordAt(words, 2.5)).toBeNull();
  });
  it('is empty before the first word', () => {
    expect(wordAt([{ i: 0, s: 1, e: 2 }], 0.5)).toBeNull();
    expect(wordAt([], 1)).toBeNull();
  });
});
