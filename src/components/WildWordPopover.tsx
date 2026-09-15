import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import WordDetail from '@/components/WordDetail';
import AddWordButton from '@/components/AddWordButton';
import { useDeck } from '@/contexts/DeckContext';
import {
  senseToCard,
  senseWord,
  senseEnglish,
  type TaggedSense,
} from '@/lib/reader-word';

interface WildWordPopoverProps {
  /** The word as it appears in the text, punctuation and all. */
  text: string;
  /** The same word with the punctuation taken off. */
  word?: string;
  /** Every reading the word could be. May be empty for an untagged word. */
  senses: TaggedSense[];
}

/**
 * A word met while reading, described the way a flashcard describes one.
 *
 * It renders WordDetail — the same panel as the card's answer side, the deck
 * list and the phone widget — so a word carries its root, its other forms, its
 * word family and what the deck already holds on its root, wherever it is met.
 * It used to show a thinner panel of its own, which meant a word read
 * differently depending on where you happened to meet it.
 *
 * Without diacritics a skeleton is genuinely ambiguous, so any further
 * readings are listed under the first rather than one being guessed at.
 */
const WildWordPopover = ({ text, word, senses }: WildWordPopoverProps) => {
  const [open, setOpen] = useState(false);
  const deck = useDeck();
  const [primary, ...others] = senses;
  const bare = word ?? text;
  const card = primary ? senseToCard(primary, bare) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${text}${primary ? ` — ${senseEnglish(primary)}` : ''}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className={`cursor-help rounded underline decoration-dotted underline-offset-4 transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
            primary ? 'decoration-primary/50' : 'decoration-muted-foreground/30'
          }`}
        >
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="max-h-[70vh] w-80 space-y-2 overflow-y-auto"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-0.5 text-center">
          <p className="font-arabic text-xl font-bold text-foreground" dir="rtl">
            {card?.word ?? bare}
          </p>
          {card?.english ? (
            <p className="text-sm leading-snug text-muted-foreground">{card.english}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Nothing recorded for this word yet.</p>
          )}
        </div>

        {card && <WordDetail card={card} deck={deck} />}

        <div className="border-t border-border/60 pt-2">
          <AddWordButton
            word={{
              word: card?.word ?? bare,
              english: card?.english ?? null,
              root: card?.root ?? null,
              wordType: card?.wordType ?? null,
              verbForm: card?.verbForm ?? null,
            }}
          />
        </div>

        {others.length > 0 && (
          <div className="space-y-1 border-t border-border/60 pt-2">
            <p className="text-xs font-medium text-muted-foreground">
              Without diacritics this could also be:
            </p>
            <ul className="space-y-1.5">
              {others.map((sense, i) => (
                <li key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-arabic text-sm text-foreground" dir="rtl">
                      {senseWord(sense, bare)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {sense.wordType ?? sense.pos ?? ''}
                    </span>
                  </div>
                  {senseEnglish(sense) && (
                    <p className="text-xs text-muted-foreground">{senseEnglish(sense)}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default WildWordPopover;
