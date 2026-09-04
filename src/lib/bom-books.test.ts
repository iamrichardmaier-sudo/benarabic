import { describe, it, expect } from 'vitest';
import { BOM_BOOKS, BOM_CHAPTER_COUNT, bomBook } from './bom-books';

describe('BOM_BOOKS', () => {
  it('lists all fifteen books', () => {
    expect(BOM_BOOKS).toHaveLength(15);
  });

  it('runs from 1 Nephi to Moroni in order', () => {
    expect(BOM_BOOKS[0].name).toBe('1 Nephi');
    expect(BOM_BOOKS[BOM_BOOKS.length - 1].name).toBe('Moroni');
    expect(BOM_BOOKS.map((b) => b.order)).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 1),
    );
  });

  it('totals 239 chapters', () => {
    expect(BOM_CHAPTER_COUNT).toBe(239);
  });

  it('gives every book a positive chapter count', () => {
    expect(BOM_BOOKS.filter((b) => b.chapters < 1)).toEqual([]);
  });

  it('has no duplicate codes, since the code keys the stored text', () => {
    const codes = BOM_BOOKS.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('looks a book up by code', () => {
    expect(bomBook('Alma')?.chapters).toBe(63);
    expect(bomBook('Nope')).toBeUndefined();
  });
});
