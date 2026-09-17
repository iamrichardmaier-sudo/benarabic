import type { FlashCard } from '@/lib/spaced-repetition';

/** What "recently" means for the practice button. */
export const RECENT_DAYS = 7;

/**
 * The words learned in the last week, newest first.
 *
 * A card counts once it has graduated out of the learning stages — that is the
 * moment it was actually learned rather than merely added — and while it was
 * added inside the window. Cards from before then are on their own schedule
 * and are not what this button is for.
 *
 * A deck taken up as already-known is graduated from the moment it arrives,
 * which would otherwise make a freshly-parked 500-word deck look like a
 * week's work and offer to drill all of it. Those cards were placed here, not
 * learned here, so they are left out.
 */
export function learnedRecently(
  cards: FlashCard[],
  days: number = RECENT_DAYS,
  now: Date = new Date(),
): FlashCard[] {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return cards
    .filter((c) => {
      if (c.learningStage !== 'graduated') return false;
      if (c.placedAs) return false;
      if (!c.createdAt) return false;
      const added = new Date(c.createdAt).getTime();
      // An unparseable date should not silently pull an old card in.
      return !Number.isNaN(added) && added >= cutoff;
    })
    .sort((a, b) => new Date(b.createdAt as string).getTime() - new Date(a.createdAt as string).getTime());
}
