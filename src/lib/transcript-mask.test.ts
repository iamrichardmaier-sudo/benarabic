import { describe, it, expect } from 'vitest';
import { tokenize, shuffledWordOrder, hiddenIndices, maskWord } from './transcript-mask';

describe('tokenize', () => {
  it('splits into words and whitespace, reconstructing the original exactly', () => {
    const content = 'أنا محمد، وهذا بيتي.';
    const tokens = tokenize(content);
    expect(tokens.map((t) => t.text).join('')).toBe(content);
  });

  it('marks whitespace tokens (including newlines) as not words', () => {
    const tokens = tokenize('أول\nثاني  ثالث');
    const whitespace = tokens.filter((t) => !t.isWord);
    expect(whitespace.map((t) => t.text)).toEqual(['\n', '  ']);
  });

  it('keeps punctuation attached to its word rather than splitting it out', () => {
    const tokens = tokenize('كلية الآداب،');
    const words = tokens.filter((t) => t.isWord);
    expect(words.map((t) => t.text)).toEqual(['كلية', 'الآداب،']);
  });

  it('produces nothing for an empty string', () => {
    expect(tokenize('')).toEqual([]);
  });
});

describe('shuffledWordOrder + hiddenIndices', () => {
  it('covers every index exactly once', () => {
    const order = shuffledWordOrder(20);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it('hides nothing at 0% and everything at 100%', () => {
    const order = shuffledWordOrder(10);
    expect(hiddenIndices(order, 0).size).toBe(0);
    expect(hiddenIndices(order, 100).size).toBe(10);
  });

  it('a higher percentage only ever adds to the hidden set, never removes', () => {
    const order = shuffledWordOrder(50);
    const at20 = hiddenIndices(order, 20);
    const at60 = hiddenIndices(order, 60);
    for (const i of at20) expect(at60.has(i)).toBe(true);
  });

  it('clamps out-of-range percentages instead of throwing', () => {
    const order = shuffledWordOrder(10);
    expect(hiddenIndices(order, -5).size).toBe(0);
    expect(hiddenIndices(order, 500).size).toBe(10);
  });
});

describe('maskWord', () => {
  it('gives a fixed placeholder with the checkbox off, not hinting at length', () => {
    expect(maskWord('أ', false)).toBe('____');
    expect(maskWord('بالإضافة', false)).toBe('____');
  });

  it('keeps the first letter when asked', () => {
    expect(maskWord('محمد', true)).toBe('م____');
  });

  it('keeps leading punctuation plus the real first letter, not just the punctuation', () => {
    expect(maskWord('"بيت', true)).toBe('"ب____');
  });

  it('keeps trailing punctuation masked along with the rest of the word', () => {
    const masked = maskWord('الآداب،', true);
    expect(masked.startsWith('ا')).toBe(true);
    expect(masked).not.toContain('لآداب');
  });
});
