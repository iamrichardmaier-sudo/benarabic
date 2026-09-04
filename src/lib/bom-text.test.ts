import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { BOM_BOOKS } from './bom-books';

/**
 * The extracted Book of Mormon, checked as data.
 *
 * The text is machine-recovered from a PDF whose fonts carry a broken
 * character map, so its failure modes are quiet ones: a glyph left as a Latin
 * letter, an English block swallowed into the Arabic column, a chapter missed
 * because its running head is shaped differently, an English word mangled by
 * a repair meant for Arabic. Every one of those happened at least once while
 * the extractor was being written, and every one is checked here.
 */
const DIR = 'public/bom';
const TASHKEEL = /[ً-ْٰ]/;
const ARABIC = /[؀-ۿ]/;

interface Verse {
  v: number;
  a: string;
  e: string;
}

const chapters = BOM_BOOKS.flatMap((b) =>
  Array.from({ length: b.chapters }, (_, i) => ({ book: b.code, chapter: i + 1 })),
);

it('has a file for all 239 chapters', () => {
  const missing = chapters.filter((c) => !existsSync(`${DIR}/${c.book}/${c.chapter}.json`));
  expect(missing.map((c) => `${c.book} ${c.chapter}`)).toEqual([]);
});

describe('every chapter', () => {
  const all = chapters.map((c) => ({
    ...c,
    verses: JSON.parse(
      readFileSync(`${DIR}/${c.book}/${c.chapter}.json`, 'utf8'),
    ) as Verse[],
  }));

  const flag = (pick: (v: Verse) => boolean) =>
    all.flatMap((c) =>
      c.verses.filter(pick).map((v) => `${c.book} ${c.chapter}:${v.v}`),
    );

  it('totals 6,604 verses, the count the work actually has', () => {
    expect(all.reduce((n, c) => n + c.verses.length, 0)).toBe(6604);
  });

  it('numbers its verses from 1 with no gaps', () => {
    const bad = all.filter((c) => c.verses.some((verse, i) => verse.v !== i + 1));
    expect(bad.map((c) => `${c.book} ${c.chapter}`)).toEqual([]);
  });

  it('gives every verse both languages', () => {
    expect(flag((v) => !v.a.trim() || !v.e.trim())).toEqual([]);
  });

  it('keeps the tashkeel, which is what makes the Arabic teachable', () => {
    expect(flag((v) => !TASHKEEL.test(v.a))).toEqual([]);
  });

  it('never leaves English stranded in the Arabic column', () => {
    // The two runs meet mid-line with punctuation between them, so a split
    // that missed the join put the whole line in the Arabic and lost the
    // English entirely — 554 verses, before it was fixed.
    expect(flag((v) => /[A-Za-z]{4,}/.test(v.a)).slice(0, 10)).toEqual([]);
  });

  it('leaves no unmapped glyph standing in for an Arabic letter', () => {
    // "W" was the alef of a lam-alef ligature 3,441 times.
    expect(flag((v) => /[W¿]/.test(v.a))).toEqual([]);
  });

  it('repaired the ft ligature the English font dropped', () => {
    expect(flag((v) => /\b(afer|lef|ofen|fifh|fify)\b/i.test(v.e))).toEqual([]);
  });

  it('did not eat the W in English words while repairing Arabic', () => {
    // A global W -> alef replace destroyed "Wherefore" 183 times before the
    // repair was made context-sensitive.
    const text = all.flatMap((c) => c.verses.map((v) => v.e)).join(' ');
    expect(text.match(/\bWherefore\b/g)?.length ?? 0).toBeGreaterThan(150);
  });

  it('starts every Arabic verse in Arabic', () => {
    expect(flag((v) => !ARABIC.test(v.a.trim()[0] ?? ''))).toEqual([]);
  });
});
