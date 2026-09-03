import { normalizeArabic } from './arabic-normalize';
import type { FlashCard } from './spaced-repetition';

/**
 * The "other words" lists shown beside a word: the rest of its root family in
 * the deck, and the other words the learner knows built on the same pattern.
 *
 * This is a direct port of the logic in scripts/scriptable/wazn-review.js, so
 * a card reads the same on the phone widget as it does in the browser. Keep
 * the two in step — there is no shared module between a TypeScript bundle and
 * a Scriptable script.
 */

export interface RelatedWord {
  /** The Arabic to show, vowelled where the card has a vowelled spelling. */
  ar: string;
  /** The gloss to show beside it. */
  en: string;
}

/** See-also lists, not concordances: past a handful they stop teaching. */
export const MAX_RELATED = 6;

/**
 * The comparison key for "is this the same word?".
 *
 * Cards sometimes carry two spellings in one field (`طول / طِوال`), and the
 * same word appears vowelled in one place and bare in another, so comparing
 * the stored strings would let a word turn up in its own see-also list.
 */
export function wordKey(value: string | null | undefined): string {
  return normalizeArabic(String(value ?? '').split('/')[0]).trim();
}

function display(card: FlashCard): RelatedWord {
  return { ar: card.wordVoweled || card.word, en: card.english || '' };
}

export interface Related {
  sameRoot: RelatedWord[];
  sameForm: RelatedWord[];
}

/**
 * Words related to `card` drawn from the learner's own deck.
 *
 * One `seen` set spans both lists and is pre-loaded with the card itself and
 * its companion forms, so a word is listed once, under the first heading that
 * claims it — which is why a root whose whole family is already spelled out
 * under "word family" usually adds nothing under "same root".
 */
export function relatedInDeck(card: FlashCard, deck: FlashCard[]): Related {
  const seen = new Set<string>([wordKey(card.word), wordKey(card.wordVoweled)]);
  for (const companion of card.companionForms ?? []) seen.add(wordKey(companion.form));
  seen.delete('');

  const take = (candidates: FlashCard[]): RelatedWord[] => {
    const out: RelatedWord[] = [];
    for (const other of candidates) {
      if (other.id === card.id) continue;
      const entry = display(other);
      const key = wordKey(entry.ar);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(entry);
      if (out.length >= MAX_RELATED) break;
    }
    return out;
  };

  const sameRoot = card.root ? take(deck.filter((c) => c.root === card.root)) : [];
  const sameForm = card.verbForm ? take(deck.filter((c) => c.verbForm === card.verbForm)) : [];

  return { sameRoot, sameForm };
}

/** True when a word has anything worth showing beyond its gloss. */
export function hasWordDetail(card: FlashCard): boolean {
  return !!(
    card.root ||
    card.verbForm ||
    card.fushaPlural ||
    card.shaami ||
    card.shaamiPlural ||
    card.pastTense ||
    card.presentTense ||
    card.masdarForm ||
    (card.companionForms && card.companionForms.length > 0)
  );
}
