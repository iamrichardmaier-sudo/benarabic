import { normalizeArabic } from './arabic-normalize';

/**
 * Putting a sentence's words back in order.
 *
 * The tiles are the sentence's words, split on spaces. Punctuation stays off
 * the tiles (a question mark is not a word the learner has to place), and the
 * comparison ignores harakat and the usual letter variants, so the learner is
 * judged on word order and spelling, not on whether they remembered a vowel.
 */

const EDGE_PUNCTUATION = /^[\s؟?!.,،؛;:"'“”«»()]+|[\s؟?!.,،؛;:"'“”«»()]+$/g;

/** The words of a sentence, in order, with edge punctuation removed. */
export function tokenize(sentence: string): string[] {
  return sentence
    .split(/\s+/)
    .map((t) => t.replace(EDGE_PUNCTUATION, ''))
    .filter((t) => t.length > 0);
}

const key = (token: string) => normalizeArabic(token);

/**
 * The tiles in a random order that is not already the answer.
 *
 * A shuffle that happens to come out solved teaches nothing, so it is
 * redrawn. A sentence whose words are all the same (or a single word) cannot
 * be anything else, and is returned as is.
 */
export function shuffleTiles(tiles: string[], rng: () => number = Math.random): string[] {
  const solvable = new Set(tiles.map(key)).size > 1;
  const solved = tiles.map(key).join(' ');
  let out = [...tiles];
  for (let attempt = 0; attempt < 20; attempt++) {
    out = [...tiles];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (!solvable || out.map(key).join(' ') !== solved) return out;
  }
  // Deterministic fallback: rotate by one, which differs whenever two words differ.
  return solvable ? [...tiles.slice(1), tiles[0]] : out;
}

/**
 * Whether the tiles placed, in that order, make the sentence. A tile may be a
 * chunk of several words; what is compared is the words they add up to.
 */
export function isCorrectOrder(placed: string[], sentence: string): boolean {
  const answer = tokenize(sentence).map(key);
  const words = placed.flatMap((t) => t.split(/\s+/)).filter((t) => t.length > 0);
  return words.length === answer.length && words.every((t, i) => key(t) === answer[i]);
}

/**
 * The words grouped into `pieces` runs of neighbouring words, as even as
 * possible (the longer runs first). Fewer pieces is easier: each tile carries
 * more of the sentence already in order. It never goes below two pieces, or
 * there would be nothing left to order, nor above one piece per word.
 */
export function chunkWords(words: string[], pieces: number): string[] {
  const n = words.length;
  if (n <= 2) return [...words];
  const m = Math.min(Math.max(Math.round(pieces), 2), n);
  const base = Math.floor(n / m);
  const extra = n % m;
  const out: string[] = [];
  let at = 0;
  for (let i = 0; i < m; i++) {
    const size = base + (i < extra ? 1 : 0);
    out.push(words.slice(at, at + size).join(' '));
    at += size;
  }
  return out;
}

// The chunk size last chosen, kept for the next sentence: 'all' (a tile per
// word) or a number of pieces, clamped to each sentence's length.
const PIECES_KEY = 'wazn-sentence-pieces';

export function readPieces(): number | 'all' {
  try {
    const v = localStorage.getItem(PIECES_KEY);
    const n = Number(v);
    return v !== null && v !== 'all' && Number.isInteger(n) && n >= 2 ? n : 'all';
  } catch {
    return 'all';
  }
}

export function savePieces(value: number | 'all'): void {
  try {
    localStorage.setItem(PIECES_KEY, String(value));
  } catch {
    /* kept for this sentence only */
  }
}
