import { getDueCards, type FlashCard } from './spaced-repetition';
import { normalizeArabic } from './arabic-normalize';
import { today } from './day';

export type DeckFilter = 'all' | 'due' | 'new' | 'learning' | 'known';
export type DeckSort = 'recent' | 'az' | 'next' | 'root';

export const FILTER_LABELS: Record<DeckFilter, string> = {
  all: 'All', due: 'Due', new: 'New', learning: 'Learning', known: 'Known',
};

export const SORT_LABELS: Record<DeckSort, string> = {
  recent: 'Newest first', az: 'A–Z', next: 'Next review', root: 'By root',
};

export interface CardStatus {
  key: Exclude<DeckFilter, 'all'>;
  /** Short text for the row: "Due", "New", "Learning", or the next review date. */
  label: string;
}

/**
 * Where a card stands, in the same terms as the rest of the app: "Due" is
 * exactly what the Review button will show, "New" and "Learning" are what the
 * Learn queue holds, and everything else is known, shown with when it is
 * next coming back.
 */
export function cardStatus(card: FlashCard, dueIds: Set<string>, now: Date = new Date()): CardStatus {
  if (dueIds.has(card.id)) return { key: 'due', label: 'Due' };
  if (card.learningStage === 'new') return { key: 'new', label: 'New' };
  if (card.learningStage !== 'graduated') return { key: 'learning', label: 'Learning' };
  return { key: 'known', label: nextReviewLabel(card.nextReviewDate, now) };
}

function nextReviewLabel(date: string | null | undefined, now: Date): string {
  if (!date) return 'Known';
  if (date <= today(now)) return 'Today';
  try {
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return date;
  }
}

export function dueIdSet(cards: FlashCard[], now: Date = new Date()): Set<string> {
  return new Set(getDueCards(cards, now).map((c) => c.id));
}

export function countByStatus(cards: FlashCard[], dueIds: Set<string>, now: Date = new Date()): Record<DeckFilter, number> {
  const counts: Record<DeckFilter, number> = { all: cards.length, due: 0, new: 0, learning: 0, known: 0 };
  for (const c of cards) counts[cardStatus(c, dueIds, now).key] += 1;
  return counts;
}

export function filterDeck(cards: FlashCard[], filter: DeckFilter, dueIds: Set<string>, now: Date = new Date()): FlashCard[] {
  if (filter === 'all') return cards;
  return cards.filter((c) => cardStatus(c, dueIds, now).key === filter);
}

const bare = (s: string | null | undefined) => normalizeArabic(s || '');

export function sortDeck(cards: FlashCard[], sort: DeckSort): FlashCard[] {
  const list = [...cards];
  switch (sort) {
    case 'recent':
      // Cards without a date (older rows) keep their original order, after the dated ones.
      return list
        .map((c, i) => ({ c, i }))
        .sort((a, b) => (b.c.createdAt || '').localeCompare(a.c.createdAt || '') || a.i - b.i)
        .map(({ c }) => c);
    case 'az':
      return list.sort((a, b) => bare(a.word).localeCompare(bare(b.word), 'ar'));
    case 'next': {
      // Unscheduled words (still being learned) first: they are the ones in play.
      const key = (c: FlashCard) => (c.learningStage === 'graduated' ? c.nextReviewDate || '9999' : '');
      return list.sort((a, b) => key(a).localeCompare(key(b)) || bare(a.word).localeCompare(bare(b.word), 'ar'));
    }
    case 'root':
      // Words without a root go last, alphabetically.
      return list.sort((a, b) => {
        const ra = a.root ? bare(a.root) : '￿';
        const rb = b.root ? bare(b.root) : '￿';
        return ra.localeCompare(rb, 'ar') || bare(a.word).localeCompare(bare(b.word), 'ar');
      });
  }
}
