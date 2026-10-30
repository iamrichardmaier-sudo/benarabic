import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import CardArt from '@/components/CardArt';
import SpeakButton from '@/components/SpeakButton';
import WordDetail from '@/components/WordDetail';
import type { FlashCard } from '@/lib/spaced-repetition';
import { cn } from '@/lib/utils';

interface WordRowProps {
  card: FlashCard;
  deck: FlashCard[];
  /** Shown under the meaning, e.g. "Form II · verb". */
  note?: string;
  className?: string;
}

/**
 * One of the learner's words in a list: its picture (if any), meaning and
 * Arabic, opening in place onto everything the app knows about it.
 */
const WordRow = ({ card, deck, note, className }: WordRowProps) => {
  const [open, setOpen] = useState(false);
  const arabic = card.wordVoweled || card.word;
  return (
    <div className={cn('px-3 py-2', className)}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${card.english || card.word}: ${open ? 'hide' : 'show'} details`}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-start transition-colors"
        >
          <CardArt card={card} size="xs" className="mx-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{card.english || '—'}</span>
            {note && <span className="block truncate text-xs text-muted-foreground">{note}</span>}
          </span>
          <span className="font-arabic shrink-0 text-xl text-foreground" dir="rtl">{arabic}</span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </button>
        <SpeakButton word={card.word} size={16} />
      </div>
      {open && (
        <div className="mt-2 rounded-xl border border-border/60 bg-background p-3">
          <WordDetail card={card} deck={deck} />
        </div>
      )}
    </div>
  );
};

export default WordRow;
