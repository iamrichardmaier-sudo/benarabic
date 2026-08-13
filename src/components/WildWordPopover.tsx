import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { WordSense } from '@/hooks/useWordSkeletonIndex';

const POS_LABELS: Record<string, string> = {
  verb: 'Verb',
  noun: 'Noun',
  adjective: 'Adjective',
  participle: 'Participle',
  proper_noun: 'Name',
  particle: 'Particle',
  other: 'Word',
};

function subtitleFor(sense: WordSense): string {
  const posLabel = POS_LABELS[sense.pos] ?? sense.pos;
  return [posLabel, sense.verbForm ? `Form ${sense.verbForm}` : null].filter(Boolean).join(' · ');
}

interface WildWordPopoverProps {
  text: string;
  senses: WordSense[];
}

/**
 * Hover-or-tap word info for arbitrary (unvoweled) Arabic text, matched
 * against the Bible word-tagging database by consonant skeleton. Unlike the
 * Bible reader's exact-surface match, a skeleton is often genuinely
 * ambiguous without diacritics -- so this shows every candidate reading
 * rather than guessing one, with the most common one first.
 */
const WildWordPopover = ({ text, senses }: WildWordPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [primary, ...others] = senses;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${text}${primary.gloss ? ` — ${primary.gloss}` : ''}`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className="cursor-help rounded underline decoration-dotted decoration-primary/50 underline-offset-4 transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        className="w-72 space-y-2"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-0.5">
          <p className="font-arabic text-lg font-bold text-foreground" dir="rtl">
            {primary.lemma}
          </p>
          <p className="text-xs font-medium text-primary">{subtitleFor(primary)}</p>
        </div>

        {primary.gloss && <p className="text-sm leading-snug text-muted-foreground">{primary.gloss}</p>}

        {primary.root && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Root <span className="font-arabic text-sm text-foreground" dir="rtl">{primary.root}</span>
          </p>
        )}

        {others.length > 0 && (
          <div className="space-y-1 border-t border-border/60 pt-2">
            <p className="text-xs font-medium text-muted-foreground">
              Without diacritics this could also be:
            </p>
            <ul className="space-y-1.5">
              {others.map((sense, i) => (
                <li key={i} className="space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-arabic text-sm text-foreground" dir="rtl">{sense.lemma}</span>
                    <span className="text-[11px] text-muted-foreground">{subtitleFor(sense)}</span>
                  </div>
                  {sense.gloss && <p className="text-xs text-muted-foreground">{sense.gloss}</p>}
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
