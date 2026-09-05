import { wordKey } from './word-relations';
import { attestedIn, type DictionaryEntry } from './dictionary';
import type { FlashCard } from './spaced-repetition';

/**
 * One search over everything the app knows about a word.
 *
 * Today that means two places: the learner's own deck, held in memory, and
 * the shared dictionary built from the tagged scriptures. `source` is deliberately
 * open-ended — when words published by other learners land they become a
 * third source and slot into the same list without the UI changing shape.
 */

export type LookupSource = 'deck' | 'corpus' | 'community';

export interface LookupResult {
  /** Consonant skeleton — the identity used to merge the same word across sources. */
  key: string;
  /** Stable React key; the id of whichever record supplied the row. */
  id: string;
  lemma: string;
  root: string | null;
  pos: string | null;
  verbForm: string | null;
  glosses: string[];
  /** Times attested in the corpus, where the word came from there. */
  occurrences: number | null;
  /** Which work those occurrences are in — "in the Bible", "in scripture". */
  attestedIn: string | null;
  /** Every place this word was found, in the order they were merged. */
  sources: LookupSource[];
  /** True when the learner already has a card for it. */
  inDeck: boolean;
}

function fromCard(card: FlashCard): LookupResult {
  return {
    key: wordKey(card.wordVoweled || card.word),
    id: `deck:${card.id}`,
    lemma: card.wordVoweled || card.word,
    root: card.root ?? null,
    pos: card.wordType ?? null,
    verbForm: card.verbForm ?? null,
    glosses: card.english ? [card.english] : [],
    occurrences: null,
    attestedIn: null,
    sources: ['deck'],
    inDeck: true,
  };
}

function fromEntry(entry: DictionaryEntry): LookupResult {
  return {
    key: wordKey(entry.lemma),
    id: `dict:${entry.id}`,
    lemma: entry.lemma,
    root: entry.root,
    pos: entry.pos,
    verbForm: entry.verbForm,
    glosses: entry.glosses,
    occurrences: entry.occurrences,
    attestedIn: attestedIn(entry),
    sources: [entry.id.startsWith('community:') ? 'community' : 'corpus'],
    inDeck: false,
  };
}

/**
 * Merges the deck's matches with the dictionary's into one list.
 *
 * The learner's own words come first: a word they already have is the most
 * relevant answer to their own search, and burying it under corpus entries
 * would make the deck feel like it was not being searched at all.
 *
 * Where the same word turns up in both, the rows are folded together rather
 * than listed twice — the deck row wins, because its gloss is the one the
 * learner wrote, but it inherits the corpus's root, form and frequency where
 * the card itself was never tagged.
 */
export function mergeResults(
  deckMatches: FlashCard[],
  dictMatches: DictionaryEntry[],
): LookupResult[] {
  const byKey = new Map<string, LookupResult>();
  const order: string[] = [];

  for (const card of deckMatches) {
    const row = fromCard(card);
    if (!row.key || byKey.has(row.key)) continue;
    byKey.set(row.key, row);
    order.push(row.key);
  }

  for (const entry of dictMatches) {
    const row = fromEntry(entry);
    if (!row.key) continue;
    const existing = byKey.get(row.key);
    if (!existing) {
      byKey.set(row.key, row);
      order.push(row.key);
      continue;
    }
    existing.sources = [...existing.sources, ...row.sources];
    existing.root = existing.root ?? row.root;
    existing.pos = existing.pos ?? row.pos;
    existing.verbForm = existing.verbForm ?? row.verbForm;
    existing.occurrences = existing.occurrences ?? row.occurrences;
    existing.attestedIn = existing.attestedIn ?? row.attestedIn;
    // A card with no gloss of its own is better off borrowing the corpus's
    // than showing nothing.
    if (existing.glosses.length === 0) existing.glosses = row.glosses;
  }

  return order.map((key) => byKey.get(key) as LookupResult);
}

/** Marks results the learner already has a card for, comparing skeletons. */
export function markOwned(results: LookupResult[], deck: FlashCard[]): LookupResult[] {
  const owned = new Set<string>();
  for (const card of deck) {
    owned.add(wordKey(card.word));
    if (card.wordVoweled) owned.add(wordKey(card.wordVoweled));
  }
  owned.delete('');
  return results.map((r) => (r.inDeck || owned.has(r.key) ? { ...r, inDeck: true } : r));
}

/**
 * The roots worth suggesting from, newest first.
 *
 * The deck arrives ordered oldest-first, so the tail is what the learner has
 * been adding lately — a better guess at what they are working on than the
 * words they added months ago and have long since learned.
 */
export function recentRoots(deck: FlashCard[], limit = 6): string[] {
  const roots: string[] = [];
  const seen = new Set<string>();
  for (let i = deck.length - 1; i >= 0 && roots.length < limit; i--) {
    const root = deck[i].root;
    if (!root || seen.has(root)) continue;
    seen.add(root);
    roots.push(root);
  }
  return roots;
}
