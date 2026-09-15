import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { WordSense } from '@/hooks/useWordSkeletonIndex';
import AddWordButton from '@/components/AddWordButton';

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
  /** The word as it appears in the text, punctuation and all. */
  text: string;
  /** The same word with the punctuation taken off, for adding to the deck. */
  word?: string;
  /** Every reading the word could be. May be empty for an untagged word. */
  senses: WordSense[];
}

/**
 * Hover-or-tap word info for arbitrary (unvoweled) Arabic text, matched
 * against the Bible word-tagging database by consonant skeleton. Unlike the
 * Bible reader's exact-surface match, a skeleton is often genuinely
 * ambiguous without diacritics -- so this shows every candidate reading
 * rather than guessing one, with the most common one first.
 */
const WildWordPopover = ({ text, word, senses }: WildWordPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [primary, ...others] = senses;
  const bare = word ?? text;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${text}${primary?.gloss ? ` — ${primary.gloss}` : ''}`}
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
        className="w-72 space-y-2"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-0.5">
          <p className="font-arabic text-lg font-bold text-foreground" dir="rtl">
            {primary?.lemma ?? bare}
          </p>
          {primary ? (
            <p className="text-xs font-medium text-primary">{subtitleFor(primary)}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nothing recorded for this word yet.
            </p>
          )}
        </div>

        {primary?.gloss && (
          <p className="text-sm leading-snug text-muted-foreground">{primary.gloss}</p>
        )}

        {primary?.root && (
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            Root <span className="font-arabic text-sm text-foreground" dir="rtl">{primary.root}</span>
          </p>
        )}

        <div className="border-t border-border/60 pt-2">
          <AddWordButton
            word={{
              word: primary?.lemma ?? bare,
              english: primary?.gloss ?? null,
              root: primary?.root ?? null,
              wordType: primary?.pos ?? null,
              verbForm: primary?.verbForm ?? null,
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
