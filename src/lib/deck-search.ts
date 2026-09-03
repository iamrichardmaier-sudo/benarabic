import { normalizeArabic } from './arabic-normalize';
import type { FlashCard } from './spaced-repetition';

/**
 * Free-text search over a deck, in either script.
 *
 * Arabic is matched on the consonant skeleton, so a learner who types what
 * they can hear — undiacritized, and without knowing whether the stored
 * spelling carries a shadda — still finds the card. English is matched as a
 * plain case-insensitive substring of the gloss.
 *
 * A query is tried against both scripts rather than being routed by the
 * characters it contains, so "form ii" and "ك-ت-ب" and "write" all work
 * without the caller having to say which kind of query it is.
 */

const ARABIC = /[؀-ۿ]/;

/** Roots are stored hyphenated (ك-ت-ب); searching should not require that. */
function rootKey(value: string): string {
  return normalizeArabic(value).replace(/[-‐-―\s]/g, '');
}

function arabicFields(card: FlashCard): string[] {
  return [
    card.word,
    card.wordVoweled ?? '',
    card.shaami ?? '',
    card.fushaPlural ?? '',
    card.shaamiPlural ?? '',
    card.pastTense ?? '',
    card.presentTense ?? '',
    card.masdarForm ?? '',
    ...(card.companionForms ?? []).map((c) => c.form),
  ].filter(Boolean);
}

function englishFields(card: FlashCard): string[] {
  return [
    card.english ?? '',
    card.wordType ?? '',
    card.verbForm ? `form ${card.verbForm}` : '',
    card.group ?? '',
    ...(card.companionForms ?? []).map((c) => c.label),
  ].filter(Boolean);
}

/** True when `card` should appear for `query`. An empty query matches everything. */
export function matchesQuery(card: FlashCard, query: string): boolean {
  const q = query.trim();
  if (!q) return true;

  if (ARABIC.test(q)) {
    const needle = rootKey(q);
    if (!needle) return true;
    if (card.root && rootKey(card.root).includes(needle)) return true;
    return arabicFields(card).some((f) => normalizeArabic(f).includes(needle));
  }

  const needle = q.toLowerCase();
  if (card.root && rootKey(card.root).includes(needle)) return true;
  return englishFields(card).some((f) => f.toLowerCase().includes(needle));
}

export function searchDeck(cards: FlashCard[], query: string): FlashCard[] {
  const q = query.trim();
  if (!q) return cards;
  return cards.filter((card) => matchesQuery(card, q));
}
