import type { BibleBook } from './bible-types';

/**
 * The books of the Book of Mormon and how many chapters each holds.
 *
 * Structural facts about the work — names, order, chapter counts — not any of
 * its text. The text itself is never checked in: it belongs to whoever loaded
 * it and lives in the `private_texts` table, scoped to that reader.
 *
 * Shaped as BibleBook so the Library's book list, chapter grid and reader work
 * on it unchanged.
 */
export const BOM_BOOKS: BibleBook[] = [
  { code: '1Ne', name: '1 Nephi', order: 1, chapters: 22 },
  { code: '2Ne', name: '2 Nephi', order: 2, chapters: 33 },
  { code: 'Jacob', name: 'Jacob', order: 3, chapters: 7 },
  { code: 'Enos', name: 'Enos', order: 4, chapters: 1 },
  { code: 'Jarom', name: 'Jarom', order: 5, chapters: 1 },
  { code: 'Omni', name: 'Omni', order: 6, chapters: 1 },
  { code: 'WofM', name: 'Words of Mormon', order: 7, chapters: 1 },
  { code: 'Mosiah', name: 'Mosiah', order: 8, chapters: 29 },
  { code: 'Alma', name: 'Alma', order: 9, chapters: 63 },
  { code: 'Hel', name: 'Helaman', order: 10, chapters: 16 },
  { code: '3Ne', name: '3 Nephi', order: 11, chapters: 30 },
  { code: '4Ne', name: '4 Nephi', order: 12, chapters: 1 },
  { code: 'Morm', name: 'Mormon', order: 13, chapters: 9 },
  { code: 'Ether', name: 'Ether', order: 14, chapters: 15 },
  { code: 'Moro', name: 'Moroni', order: 15, chapters: 10 },
];

/** Every chapter in the work — what a fully loaded text would amount to. */
export const BOM_CHAPTER_COUNT = BOM_BOOKS.reduce((n, b) => n + b.chapters, 0);

export function bomBook(code: string): BibleBook | undefined {
  return BOM_BOOKS.find((b) => b.code === code);
}
