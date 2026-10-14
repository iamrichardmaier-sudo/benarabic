import { wordKey } from './word-relations';
import type { FlashCard } from './spaced-repetition';

/**
 * A word is only ever held once.
 *
 * "The same word" is decided by wordKey, the comparison the rest of the app
 * already uses for it: vowels, hamza and alef variants, and a second spelling
 * after a slash do not make two different words. A homograph that really is a
 * different word (مَلِك, king, and مَلَكَ, to own) is kept apart on purpose by
 * writing the distinction into the card itself, e.g. "ملك (فعل)".
 */
export function splitDuplicates(
  existing: Pick<FlashCard, 'word'>[],
  incoming: FlashCard[],
): { fresh: FlashCard[]; duplicates: FlashCard[] } {
  const seen = new Set(existing.map((c) => wordKey(c.word)));
  const fresh: FlashCard[] = [];
  const duplicates: FlashCard[] = [];
  for (const card of incoming) {
    const key = wordKey(card.word);
    // An empty key cannot be compared, so it is never called a duplicate.
    if (key && seen.has(key)) {
      duplicates.push(card);
      continue;
    }
    if (key) seen.add(key);
    fresh.push(card);
  }
  return { fresh, duplicates };
}
