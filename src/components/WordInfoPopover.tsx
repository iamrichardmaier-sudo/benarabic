import { useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import WordDetail from '@/components/WordDetail';
import SpeakButton from '@/components/SpeakButton';
import { hasWordDetail } from '@/lib/word-relations';
import { useDeck } from '@/contexts/DeckContext';
import type { FlashCard } from '@/lib/spaced-repetition';

interface WordInfoPopoverProps {
  card: FlashCard;
  children: ReactNode;
}

/**
 * Hover or tap a word to see everything the card knows about it.
 *
 * This used to render its own hand-made subset — plural, Shaami, principal
 * parts, companion forms — laid out differently from the card's answer side
 * and missing the root, the word family and what the deck already holds on
 * that root. It is the same duplication the reader's popover had, with the
 * same result: two panels describing one word in two shapes. WordDetail is
 * the panel now, so wherever a word is hovered it reads the same.
 *
 * The corpus lookup stays off. It costs a request, and this is a panel being
 * skimmed past rather than a card being sat with.
 */
const WordInfoPopover = ({ card, children }: WordInfoPopoverProps) => {
  const [open, setOpen] = useState(false);
  const deck = useDeck();

  const headline = card.wordVoweled || card.word;
  if (!hasWordDetail(card) && !card.english) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          // A click opens; it never toggles. Both this handler and Radix's own
          // used to toggle, and a pointer always enters before it clicks, so a
          // tap opened the panel on mouseenter and shut it again on click —
          // which is to say the panel never appeared on a phone at all.
          // preventDefault suppresses Radix's toggle; stopPropagation keeps the
          // click off whatever sits underneath, such as a card that would flip.
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setOpen(true);
          }}
          className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4"
        >
          {children}
        </span>
      </PopoverTrigger>
      <PopoverContent
        className="max-h-[70vh] w-80 overflow-y-auto"
        align="center"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-2.5">
          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="font-arabic text-2xl font-bold text-foreground" dir="rtl">
                {headline}
              </p>
              <SpeakButton word={headline} size={16} />
            </div>
            {card.english && (
              <p className="text-sm leading-snug text-foreground">{card.english}</p>
            )}
          </div>
          <WordDetail card={card} deck={deck} />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default WordInfoPopover;
