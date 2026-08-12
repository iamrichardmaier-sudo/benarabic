export interface BibleVerse {
  /** Verse number within the chapter. */
  v: number;
  /** Arabic text (Van Dyke, 1865). */
  a: string;
  /** English text (King James Version, 1769). */
  e: string;
}

export interface BibleBook {
  /** OSIS book code, e.g. "Gen", "1Sam", "Rev". */
  code: string;
  /** Display name, e.g. "Genesis". */
  name: string;
  /** Canonical order, 1-66. */
  order: number;
  /** Number of chapters in the book. */
  chapters: number;
}
