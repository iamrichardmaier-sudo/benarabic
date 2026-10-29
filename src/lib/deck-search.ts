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

/** "To write (a letter); scribe" → ["write", "scribe"]: each sense of a gloss, bare. */
function senses(english: string): string[] {
  return english
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .split(/[,;/]/)
    .map((s) => s.replace(/^\s*to\s+/, '').trim())
    .filter(Boolean);
}

/**
 * How closely a card that matches `query` matches it: the word or a sense
 * of its meaning exactly beats one starting with the query, which beats the
 * query found somewhere inside a related form or label.
 */
function score(card: FlashCard, query: string): number {
  if (ARABIC.test(query)) {
    const needle = rootKey(query);
    const heads = [card.word, card.wordVoweled ?? '', card.shaami ?? ''].filter(Boolean).map(normalizeArabic);
    if (heads.some((h) => h === needle)) return 100;
    if (card.root && rootKey(card.root) === needle) return 70;
    if (heads.some((h) => h.startsWith(needle))) return 60;
    if (heads.some((h) => h.includes(needle))) return 30;
    return 10;
  }
  const needle = query.toLowerCase().replace(/^to\s+/, '');
  const meaning = senses(card.english ?? '');
  if (meaning.some((m) => m === needle)) return 100;
  if (meaning.some((m) => m.startsWith(needle))) return 60;
  if (meaning.some((m) => new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(m))) return 40;
  if ((card.english ?? '').toLowerCase().includes(needle)) return 20;
  return 5;
}

/** The deck's matches for `query`, closest first; ties keep deck order. */
export function rankDeck(cards: FlashCard[], query: string): FlashCard[] {
  const q = query.trim();
  if (!q) return [];
  return cards
    .map((card, i) => ({ card, i }))
    .filter(({ card }) => matchesQuery(card, q))
    .map((m) => ({ ...m, s: score(m.card, q) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((m) => m.card);
}
