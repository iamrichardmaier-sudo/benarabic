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

/** Whether the words placed, in that order, are the sentence. */
export function isCorrectOrder(placed: string[], sentence: string): boolean {
  const answer = tokenize(sentence).map(key);
  return placed.length === answer.length && placed.every((t, i) => key(t) === answer[i]);
}
