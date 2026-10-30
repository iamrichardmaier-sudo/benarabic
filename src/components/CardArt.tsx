import type { FlashCard } from '@/lib/spaced-repetition';

export interface CardArtProps {
  card: Pick<FlashCard, 'word' | 'wordVoweled' | 'english' | 'root' | 'wordType' | 'verbForm'>;
  /** How much room the screen has: a list row (xs) up to a full card (lg). */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * The one place a card's picture is drawn, beside its meaning. Empty for now:
 * the animated icons it used to show looked alike and said little about the
 * word, so they were taken off.
 *
 * Every screen that shows a card already renders this slot where the picture
 * belongs — review, learn, the full-screen review and the deck list — with
 * the size it has room for, and only where a picture cannot give the answer
 * away (never on the Arabic prompt) and the card has no photo of its own. To
 * give cards art again (the calligrams in .claude/skills/arabic-calligram),
 * render it here; nothing else has to change. Return null for a card that
 * has none, and the layout closes up around it.
 */
const CardArt = (_props: CardArtProps) => null;

export default CardArt;
