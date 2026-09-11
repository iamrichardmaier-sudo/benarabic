import { describe, it, expect } from 'vitest';
import { numberToArabicWords, toArabicIndic } from './arabic-numbers';

/** كِتاب is masculine, مَجَلّة feminine — the two the drill contrasts. */
const m = (n: number) => numberToArabicWords(n, 'm');
const f = (n: number) => numberToArabicWords(n, 'f');

describe('agreement for 1 and 2', () => {
  it('agrees with the noun rather than reversing', () => {
    expect(m(1)).toBe('واحد');
    expect(f(1)).toBe('واحدة');
    expect(m(2)).toBe('اثنان');
    expect(f(2)).toBe('اثنتان');
  });
});

describe('polarity for 3 to 10', () => {
  it('takes the ة before a masculine noun', () => {
    expect(m(3)).toBe('ثلاثة');
    expect(m(10)).toBe('عشرة');
  });

  it('drops the ة before a feminine noun', () => {
    expect(f(3)).toBe('ثلاث');
    expect(f(10)).toBe('عشر');
  });
});

describe('the teens', () => {
  it('uses the special forms for 11 and 12', () => {
    expect(m(11)).toBe('أحد عشر');
    expect(f(11)).toBe('إحدى عشرة');
    expect(m(12)).toBe('اثنا عشر');
    expect(f(12)).toBe('اثنتا عشرة');
  });

  it('reverses the unit while عشر agrees', () => {
    // The two halves move in opposite directions, which is the whole trap.
    expect(m(13)).toBe('ثلاثة عشر');
    expect(f(13)).toBe('ثلاث عشرة');
    expect(m(19)).toBe('تسعة عشر');
    expect(f(19)).toBe('تسع عشرة');
  });
});

describe('the tens', () => {
  it('leaves round tens invariable', () => {
    expect(m(20)).toBe('عشرون');
    expect(f(20)).toBe('عشرون');
    expect(m(90)).toBe('تسعون');
  });

  it('still moves the unit in a compound', () => {
    expect(m(21)).toBe('واحد وعشرون');
    expect(f(21)).toBe('واحدة وعشرون');
    expect(m(23)).toBe('ثلاثة وعشرون');
    expect(f(23)).toBe('ثلاث وعشرون');
  });
});

describe('hundreds', () => {
  it('never takes a ة, because مئة is itself feminine', () => {
    expect(m(300)).toBe('ثلاثمئة');
    expect(f(300)).toBe('ثلاثمئة');
  });

  it('names 100 and 200 in their own right', () => {
    expect(m(100)).toBe('مئة');
    expect(m(200)).toBe('مئتان');
  });

  it('joins the remainder with و', () => {
    expect(m(101)).toBe('مئة وواحد');
    expect(f(101)).toBe('مئة وواحدة');
    expect(m(999)).toBe('تسعمئة وتسعة وتسعون');
  });
});

describe('thousands', () => {
  it('counts ألف as the masculine noun it is', () => {
    // ثلاثة آلاف even when what is ultimately counted is feminine.
    expect(m(3000)).toBe('ثلاثة آلاف');
    expect(f(3000)).toBe('ثلاثة آلاف');
  });

  it('names 1,000 and 2,000 in their own right', () => {
    expect(m(1000)).toBe('ألف');
    expect(m(2000)).toBe('ألفان');
  });

  it('decides ألف by its own last two digits, not by size', () => {
    expect(m(103_000)).toBe('مئة وثلاثة آلاف');
    expect(m(11_000)).toBe('أحد عشر ألف');
    expect(m(100_000)).toBe('مئة ألف');
  });

  it('carries the remainder, which is where the noun gender lands', () => {
    expect(m(3003)).toBe('ثلاثة آلاف وثلاثة');
    expect(f(3003)).toBe('ثلاثة آلاف وثلاث');
  });

  it('names a million', () => {
    expect(m(1_000_000)).toBe('مليون');
  });
});

describe('range', () => {
  it('refuses what it cannot say', () => {
    expect(() => m(0)).toThrow(RangeError);
    expect(() => m(1_000_001)).toThrow(RangeError);
    expect(() => m(1.5)).toThrow(RangeError);
  });
});

describe('toArabicIndic', () => {
  it('writes the digits the text itself uses', () => {
    expect(toArabicIndic(1234)).toBe('١٢٣٤');
    expect(toArabicIndic(1_000_000)).toBe('١٠٠٠٠٠٠');
    expect(toArabicIndic(7)).toBe('٧');
  });
});
