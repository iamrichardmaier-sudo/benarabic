import { describe, it, expect } from 'vitest';
import {
  stripShortVowels,
  stripTatweel,
  normalizeArabic,
  normalizeArabicIgnoreShortVowels,
  normalizeArabicKeepVowels,
} from './arabic-normalize';

describe('stripShortVowels', () => {
  it('removes fatha, damma and kasra', () => {
    expect(stripShortVowels('كَتَبَ')).toBe('كتب');
    expect(stripShortVowels('يَكتُب')).toBe('يكتب');
  });

  it('removes sukun and tanwin', () => {
    expect(stripShortVowels('مَعْاً')).toBe('معا');
  });

  it('keeps shadda, which distinguishes verb forms', () => {
    expect(stripShortVowels('بَدَّلَ')).toBe('بدّل');
    expect(stripShortVowels('بَدَلَ')).toBe('بدل');
    // Form II and Form I must stay distinguishable.
    expect(stripShortVowels('بَدَّلَ')).not.toBe(stripShortVowels('بَدَلَ'));
  });

  it('leaves unvowelled text untouched', () => {
    expect(stripShortVowels('كتب')).toBe('كتب');
  });
});

describe('normalizeArabicIgnoreShortVowels', () => {
  it('accepts a bare answer against a fully vowelled one', () => {
    expect(normalizeArabicIgnoreShortVowels('كتب')).toBe(normalizeArabicIgnoreShortVowels('كَتَبَ'));
  });

  it('accepts partially vowelled input', () => {
    expect(normalizeArabicIgnoreShortVowels('كَتب')).toBe(normalizeArabicIgnoreShortVowels('كَتَبَ'));
  });

  it('still rejects the wrong consonants', () => {
    expect(normalizeArabicIgnoreShortVowels('درس')).not.toBe(
      normalizeArabicIgnoreShortVowels('كَتَبَ'),
    );
  });

  it('still rejects a missing shadda', () => {
    expect(normalizeArabicIgnoreShortVowels('بدل')).not.toBe(
      normalizeArabicIgnoreShortVowels('بَدَّلَ'),
    );
  });

  it('keeps normalizing alef and taa marbuta variants', () => {
    expect(normalizeArabicIgnoreShortVowels('أكل')).toBe(normalizeArabicIgnoreShortVowels('اكل'));
    expect(normalizeArabicIgnoreShortVowels('جَولة')).toBe(normalizeArabicIgnoreShortVowels('جوله'));
  });
});

describe('normalizeArabicKeepVowels (strict mode, unchanged)', () => {
  it('still marks a missing vowel as different', () => {
    expect(normalizeArabicKeepVowels('كتب')).not.toBe(normalizeArabicKeepVowels('كَتَبَ'));
  });
});

describe('stripTatweel', () => {
  it('removes the elongation mark from a clitic preposition', () => {
    expect(stripTatweel('بِـ')).toBe('بِ');
    expect(stripTatweel('لِـ')).toBe('لِ');
  });

  it('leaves text without tatweel untouched', () => {
    expect(stripTatweel('مِن')).toBe('مِن');
  });
});

describe('normalizeArabic and tatweel', () => {
  it('matches a bare typed preposition against its tatweel citation form', () => {
    expect(normalizeArabic('ب')).toBe(normalizeArabic('بِـ'));
    expect(normalizeArabic('ل')).toBe(normalizeArabic('لِـ'));
  });
});
