// Splits a transcript into words to blank out for memorization practice,
// while preserving the exact original text — whitespace, line breaks,
// punctuation — for everything that stays visible.

export interface Token {
  /** The exact original text of this piece, whitespace included. */
  text: string;
  /** Whitespace runs are never blanked; only word tokens are candidates. */
  isWord: boolean;
}

/** Splits on whitespace, keeping the whitespace itself as its own token. */
export function tokenize(content: string): Token[] {
  return content
    .split(/(\s+)/)
    .filter((piece) => piece.length > 0)
    .map((piece) => ({ text: piece, isWord: !/^\s+$/.test(piece) }));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A fixed random ordering over the word tokens (identified by their index
 * among words only, not all tokens). The slider then hides a prefix of this
 * order, so raising the percentage only ever hides more words — it never
 * un-hides or re-shuffles ones already blanked.
 */
export function shuffledWordOrder(wordCount: number): number[] {
  return shuffle(Array.from({ length: wordCount }, (_, i) => i));
}

/** Which word-indices (0-based, counting only word tokens) should be blanked. */
export function hiddenIndices(order: number[], percent: number): Set<number> {
  const count = Math.round((Math.max(0, Math.min(100, percent)) / 100) * order.length);
  return new Set(order.slice(0, count));
}

const BLANK_ONLY = '____';

/**
 * Masks a word token. With keepFirstLetter, the leading run of letters (Arabic
 * or Latin) is kept and the rest replaced; a word starting with punctuation
 * (rare — an opening quote before direct speech) keeps that punctuation too,
 * so what's revealed is genuinely the first letter of the word, not a symbol.
 */
export function maskWord(word: string, keepFirstLetter: boolean): string {
  if (!keepFirstLetter) return BLANK_ONLY;
  const match = word.match(/^([^\p{L}]*\p{L})/u);
  const prefix = match ? match[1] : word.slice(0, 1);
  return prefix + BLANK_ONLY;
}
