import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchWordsByRoot } from '@/lib/bible-root-index';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

const POS_LABELS: Record<string, string> = {
  verb: 'Verb',
  noun: 'Noun',
  adjective: 'Adjective',
  participle: 'Participle',
  proper_noun: 'Name',
  particle: 'Particle',
  other: 'Word',
};

interface BibleWordPopoverProps {
  text: string;
  tag: BibleWordTag;
}

/**
 * Hover-or-tap word info for the Bible reader: root, lemma, gloss, and (lazily,
 * once opened) other tagged words sharing the same root. Follows the same
 * hover-for-mouse / tap-for-phone interaction as GlossPopover, but the "other
 * forms" list is fetched on open rather than passed in, so it can't be built
 * as a static-props component the way GlossPopover is.
 */
const BibleWordPopover = ({ text, tag }: BibleWordPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [related, setRelated] = useState<BibleWordTag[] | null>(null);
  const [loadingRelated, setLoadingRelated] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    if (tag.root && related === null && !loadingRelated) {
      setLoadingRelated(true);
      fetchWordsByRoot(tag.root, tag.surface)
        .then(setRelated)
        .catch((err) => {
          console.error('Could not load related words:', err);
          setRelated([]);
        })
        .finally(() => setLoadingRelated(false));
    }
  };

  const posLabel = tag.pos ? POS_LABELS[tag.pos] ?? tag.pos : undefined;
  const subtitle = [posLabel, tag.verbForm ? `Form ${tag.verbForm}` : null].filter(Boolean).join(' · ');

  return (
    <Popover open={open} onOpenChange={(next) => (next ? handleOpen() : setOpen(false))}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${text}${tag.gloss ? ` — ${tag.gloss}` : ''}`}
          onMouseEnter={handleOpen}
          onMouseLeave={() => setOpen(false)}
          onFocus={handleOpen}
          onClick={(e) => {
            e.preventDefault();
            handleOpen();
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
            {tag.lemma ?? tag.surface}
          </p>
          {subtitle && <p className="text-xs font-medium text-primary">{subtitle}</p>}
        </div>

        {tag.gloss && <p className="text-sm leading-snug text-muted-foreground">{tag.gloss}</p>}

        {tag.root && (
          <div className="space-y-1 border-t border-border/60 pt-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              Root <span className="font-arabic text-sm text-foreground" dir="rtl">{tag.root}</span>
            </p>
            {loadingRelated && <p className="text-xs text-muted-foreground">Loading related words…</p>}
            {!loadingRelated && related && related.length > 0 && (
              <ul className="space-y-1">
                {related.map((w) => (
                  <li key={w.surface} className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-arabic text-foreground" dir="rtl">{w.lemma ?? w.surface}</span>
                    <span className="text-xs text-muted-foreground truncate">{w.gloss}</span>
                  </li>
                ))}
              </ul>
            )}
            {!loadingRelated && related && related.length === 0 && (
              <p className="text-xs text-muted-foreground">No other tagged words for this root yet.</p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default BibleWordPopover;
