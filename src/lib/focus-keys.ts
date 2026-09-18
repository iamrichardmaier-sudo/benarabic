import type { Rating } from '@/lib/spaced-repetition';

/** What a keypress does in focus review. */
export type FocusAction =
  | { kind: 'flip' }
  | { kind: 'grade'; rating: Rating }
  | { kind: 'exit' }
  | null;

/**
 * The keyboard for full-screen review.
 *
 * The rhythm is the widget's, one hand on the arrow keys: right reveals the
 * answer, then right again says you knew it and left says you did not. Good
 * and Hard sit on the other two arrows for a session where the difference
 * matters, but the two that matter most are the two the widget shows.
 *
 * Nothing grades a card that has not been turned over yet — the same rule the
 * swipe gesture follows, and for the same reason: a rating given before the
 * answer was seen is not a rating of anything.
 *
 * Enter only ever flips. It is also the key that opens this screen, and a held
 * key repeats, so letting it grade would mean opening the session and marking
 * the first card Easy in one press.
 */
export function focusAction(key: string, flipped: boolean): FocusAction {
  if (key === 'Escape') return { kind: 'exit' };

  if (!flipped) {
    if (key === 'ArrowRight' || key === 'Enter' || key === ' ') return { kind: 'flip' };
    return null;
  }

  switch (key) {
    case 'ArrowRight': return { kind: 'grade', rating: 'easy' };
    case 'ArrowLeft': return { kind: 'grade', rating: 'again' };
    case 'ArrowUp': return { kind: 'grade', rating: 'good' };
    case 'ArrowDown': return { kind: 'grade', rating: 'hard' };
    // Turning the card back over to look again, without saying anything yet.
    case 'Enter':
    case ' ':
      return { kind: 'flip' };
    default: return null;
  }
}

/** The line under the card, which changes with the side showing. */
export function focusHint(flipped: boolean): string {
  return flipped ? '← Again  ·  → Easy' : '→ to flip';
}
