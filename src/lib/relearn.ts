import type { FlashCard } from './spaced-repetition';
import { sortChapterLabels } from './chapter-sort';

/**
 * Relearning a deck without touching the review schedule.
 *
 * Two small pieces: working out which of the learner's cards belong to which
 * deck, and making the in-memory copies a practice run works on. Nothing here
 * writes anywhere; that is the point of it.
 */

/** A deck the learner holds, and the bank words it contains. */
export interface DeckMembership {
  id: string;
  title: string;
  wordIds: Set<string>;
}

export interface RelearnSection {
  /** A deck id, or NOT_IN_A_DECK. */
  id: string;
  name: string;
  cards: FlashCard[];
}

export const NOT_IN_A_DECK = 'not-in-a-deck';

/**
 * The cards split by deck, decks in chapter order, then whatever is in none.
 *
 * A word can sit in several decks, so a card can appear under each of them;
 * choosing it in either is choosing the same card. A deck with none of the
 * learner's cards in it is left out, since there would be nothing to relearn.
 */
export function sectionsByDeck(cards: FlashCard[], decks: DeckMembership[]): RelearnSection[] {
  const byTitle = new Map<string, DeckMembership[]>();
  for (const d of decks) {
    const list = byTitle.get(d.title);
    if (list) list.push(d);
    else byTitle.set(d.title, [d]);
  }

  const sections: RelearnSection[] = [];
  const inSome = new Set<string>();
  for (const title of sortChapterLabels([...byTitle.keys()])) {
    for (const deck of byTitle.get(title) ?? []) {
      const own = cards.filter((c) => c.wordId && deck.wordIds.has(c.wordId));
      if (own.length === 0) continue;
      for (const c of own) inSome.add(c.id);
      sections.push({ id: deck.id, name: deck.title, cards: own });
    }
  }

  const rest = cards.filter((c) => !inSome.has(c.id));
  if (rest.length > 0) sections.push({ id: NOT_IN_A_DECK, name: 'Not in a deck', cards: rest });
  return sections;
}

/**
 * A card as the practice run starts it: back at the first stage, with its
 * attempts cleared, but only in memory. The stored card (its due date,
 * interval and ease) is never touched, which is why relearning leaves the
 * timed review exactly where it was.
 */
export function practiceCopy(card: FlashCard): FlashCard {
  return { ...card, learningStage: 'new', stage1Attempts: 0, stage2Attempts: 0 };
}
