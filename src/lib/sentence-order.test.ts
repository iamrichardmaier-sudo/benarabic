import { describe, it, expect } from 'vitest';
import { tokenize, shuffleTiles, isCorrectOrder } from './sentence-order';

const q = 'قَدّيش بِدَّك تِبقى بِأَمريكا؟';

describe('tokenize', () => {
  it('splits on spaces and keeps punctuation off the tiles', () => {
    expect(tokenize(q)).toEqual(['قَدّيش', 'بِدَّك', 'تِبقى', 'بِأَمريكا']);
    expect(tokenize('عَجَبَتَك تَجرِبِة الهِجرة، وَلَو لِفترة؟')).toEqual([
      'عَجَبَتَك', 'تَجرِبِة', 'الهِجرة', 'وَلَو', 'لِفترة',
    ]);
  });

  it('ignores extra whitespace and empty input', () => {
    expect(tokenize('  شو   هون  ')).toEqual(['شو', 'هون']);
    expect(tokenize('')).toEqual([]);
  });
});

describe('shuffleTiles', () => {
  it('never hands back the solved order, however the dice fall', () => {
    const tiles = tokenize(q);
    // A generator that would leave the order untouched.
    expect(shuffleTiles(tiles, () => 0.999)).not.toEqual(tiles);
    for (let i = 0; i < 50; i++) expect(shuffleTiles(tiles)).not.toEqual(tiles);
  });

  it('keeps every tile', () => {
    const tiles = tokenize(q);
    expect([...shuffleTiles(tiles)].sort()).toEqual([...tiles].sort());
  });

  it('returns a one-word sentence as it is', () => {
    expect(shuffleTiles(['هون'])).toEqual(['هون']);
  });
});

describe('isCorrectOrder', () => {
  it('accepts the sentence in order', () => {
    expect(isCorrectOrder(tokenize(q), q)).toBe(true);
  });

  it('rejects any other order, or a missing word', () => {
    const t = tokenize(q);
    expect(isCorrectOrder([t[1], t[0], t[2], t[3]], q)).toBe(false);
    expect(isCorrectOrder(t.slice(0, 3), q)).toBe(false);
  });

  it('does not penalise missing vowels or alef variants', () => {
    expect(isCorrectOrder(['قديش', 'بدك', 'تبقى', 'بامريكا'], q)).toBe(true);
  });
});
