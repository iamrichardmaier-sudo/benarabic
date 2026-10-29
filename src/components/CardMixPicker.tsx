import { CARD_MIXES, type CardMix } from '@/lib/learn-filter';
import { cn } from '@/lib/utils';

interface CardMixPickerProps {
  value: CardMix;
  onChange: (mix: CardMix) => void;
  /** Shown beside Vocab and Sentences, so an empty choice is visible before it is picked. */
  counts?: { words: number; sentences: number };
  /** Names the group for screen readers. */
  label?: string;
  className?: string;
}

/** Both · Vocab · Sentences, as one segmented control. */
const CardMixPicker = ({ value, onChange, counts, label = 'Cards to study', className }: CardMixPickerProps) => (
  <div
    role="radiogroup"
    aria-label={label}
    className={cn('grid grid-cols-3 gap-1 rounded-xl bg-muted p-1', className)}
  >
    {CARD_MIXES.map((m) => {
      const picked = m.id === value;
      const count = !counts ? null
        : m.id === 'words' ? counts.words
        : m.id === 'sentences' ? counts.sentences
        : counts.words + counts.sentences;
      return (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={picked}
          onClick={() => onChange(m.id)}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition-all active:scale-95',
            picked ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {m.label}
          {count !== null && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[11px] tabular-nums',
                picked ? 'bg-primary/15 text-primary' : 'bg-background/60',
              )}
            >
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default CardMixPicker;
