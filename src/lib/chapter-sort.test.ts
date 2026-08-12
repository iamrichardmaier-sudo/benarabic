import { describe, it, expect } from 'vitest';
import { sortChapterLabels } from './chapter-sort';

describe('sortChapterLabels', () => {
  it('orders by the embedded number, not lexicographically', () => {
    expect(sortChapterLabels(['Chapter 10', 'Chapter 2', 'Chapter 1'])).toEqual([
      'Chapter 1',
      'Chapter 2',
      'Chapter 10',
    ]);
  });

  it('puts unnumbered labels after numbered ones', () => {
    expect(sortChapterLabels(['Ungrouped', 'Chapter 3'])).toEqual(['Chapter 3', 'Ungrouped']);
  });

  it('falls back to alphabetical when nothing has a number', () => {
    expect(sortChapterLabels(['Verbs', 'Adjectives'])).toEqual(['Adjectives', 'Verbs']);
  });

  it('does not mutate the input array', () => {
    const input = ['Chapter 5', 'Chapter 1'];
    sortChapterLabels(input);
    expect(input).toEqual(['Chapter 5', 'Chapter 1']);
  });
});
