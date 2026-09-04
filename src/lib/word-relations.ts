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

/**
 * The key for asking "is this companion form already on the card?".
 *
 * Bare consonants, and without the definite article: a masdar is conventionally
 * cited with ال (الرُّجوع) while the word family lists it without (رُجوع), and
 * printing the same word under both "Masdar" and "Word family" reads as a bug.
 */
export function formKey(value: string | null | undefined): string {
  return normalizeArabic(String(value ?? '').split('/')[0])
    .replace(/^ال/, '')
    .trim();
}

/**
 * Companion forms worth printing, given what the labelled rows already show.
 *
 * Two different comparisons, deliberately:
 *
 * - against the labelled rows, by consonant skeleton, because that is where
 *   the same word appears in two spellings (الشُّكر as the masdar, شُكر in the
 *   family);
 * - against the other companions and the headword, by exact text, because a
 *   word family is *made of* words that share a skeleton. مُلهِم (inspiring)
 *   and مُلهَم (inspired) differ only in a vowel and are exactly the pair worth
 *   teaching — collapsing them would throw away the point of the section.
 */
export function visibleCompanions(
  companions: { form: string; label: string }[],
  headline: string,
  labelledRows: (string | null | undefined)[],
): { form: string; label: string }[] {
  const rowKeys = new Set(labelledRows.map(formKey));
  rowKeys.delete('');

  const seenText = new Set<string>([String(headline ?? '').trim()]);
  const out: { form: string; label: string }[] = [];

  for (const companion of companions) {
    const text = String(companion.form ?? '').trim();
    if (!text || seenText.has(text)) continue;
    if (rowKeys.has(formKey(text))) continue;
    seenText.add(text);
    out.push(companion);
  }
  return out;
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
