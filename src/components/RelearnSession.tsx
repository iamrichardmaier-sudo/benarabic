import { useCallback, useState } from 'react';
import LearningMode from '@/components/LearningMode';
import type { FlashCard } from '@/lib/spaced-repetition';

interface RelearnSessionProps {
  /** Practice copies (see practiceCopy): already back at the first stage. */
  cards: FlashCard[];
  /** The whole deck, which wrong answers are drawn from. */
  allCards: FlashCard[];
  onBack: () => void;
  onEarn?: (xp: number) => void;
}

/**
 * Relearning a set of cards with the Learn questions, writing nothing.
 *
 * LearningMode moves a card forward by reading the cards it is given back
 * with their new stage, which in the Learn screen is the saved deck. Here the
 * cards live in this component's own state instead, so each stage change is
 * applied to the copy and goes no further: the stored cards, and so the
 * timed review, are exactly as they were.
 */
const RelearnSession = ({ cards, allCards, onBack, onEarn }: RelearnSessionProps) => {
  const [local, setLocal] = useState(cards);

  const update = useCallback((id: string, updates: Partial<FlashCard>) => {
    setLocal((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  }, []);

  return (
    <LearningMode
      practice
      header={
        <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Relearning {cards.length} card{cards.length === 1 ? '' : 's'}. Your review schedule is not changed.
        </p>
      }
      cards={local}
      allCards={allCards}
      onUpdateCard={update}
      onBack={onBack}
      onEarn={onEarn}
    />
  );
};

export default RelearnSession;
