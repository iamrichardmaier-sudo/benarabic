import { normalizeArabic } from './arabic-normalize';
import type { Dialect } from './preferences';
import type { FlashCard } from './spaced-repetition';

/**
 * Which Arabic a card leads with, and which of its other forms are worth
 * showing, once the learner has chosen a dialect to study.
 *
 * The governing rule is that choosing a dialect must never shrink the deck.
 * Only a minority of cards carry a separate Shaami form — many words are
 * identical in both — so 'shaami' falls back to the Fusha rather than
 * skipping the card or showing a blank prompt.
 */

export interface DialectView {
  /** The Arabic to lead with, vowelled where a vowelled spelling exists. */
  headline: string;
  /** The Arabic to read aloud and to grade a typed answer against. */
  spoken: string;
  /**
   * Rows to add to "its other forms" that the headline has displaced —
   * showing the Fusha when Shaami is leading, and nothing otherwise.
   */
  extraForms: { label: string; value: string }[];
  /** False when this card has no Shaami of its own and is showing Fusha. */
  isDialectForm: boolean;
}

/** True when the card records a Shaami form distinct from its Fusha. */
export function hasShaami(card: FlashCard): boolean {
  return !!(card.shaami && card.shaami.trim());
}

export function dialectView(card: FlashCard, dialect: Dialect): DialectView {
  const fusha = card.wordVoweled || card.word;

  if (dialect === 'shaami' && hasShaami(card)) {
    const shaami = card.shaami as string;
    // The Fusha is no longer the headline, so it moves into the detail rather
    // than disappearing — the point is to compare the two registers, not to
    // pretend the other one does not exist. The exception is a Form I verb,
    // whose Fusha citation form is its past tense: the panel already lists
    // that, and printing the same word twice under two labels reads as an
    // error rather than as a comparison.
    const duplicatesPast =
      !!card.pastTense && normalizeArabic(card.pastTense) === normalizeArabic(fusha);

    return {
      headline: shaami,
      spoken: shaami,
      extraForms: duplicatesPast ? [] : [{ label: 'Fusha', value: fusha }],
      isDialectForm: true,
    };
  }

  return { headline: fusha, spoken: fusha, extraForms: [], isDialectForm: false };
}

/**
 * Whether the Shaami rows belong in the detail panel.
 *
 * Only 'msa' hides them: a learner who has chosen Fusha does not want the
 * dialect in front of them. Nothing is hidden in the other direction — the
 * Fusha plural and principal parts stay visible under 'shaami', because a
 * card stores no separate Shaami conjugation and dropping them would leave
 * the panel emptier rather than more focused.
 */
export function showsShaamiRows(dialect: Dialect): boolean {
  return dialect !== 'msa';
}
