import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchWordsByRoot, splitRootSense } from '@/lib/bible-root-index';
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
 * Hover-or-tap word info for the reader, shaped like the back of a flashcard:
 * what the word is, what it means, its root, and the family built on it with
 * a meaning against each one.
 *
 * Most words in the Book of Mormon carry a root and nothing else — the root
 * was propagated from the Bible, the vowels were not, so no gloss could be
 * borrowed honestly. Rather than showing a heading with a blank under it,
 * those words lead with the meaning of the root, labelled as the root's and
 * not the word's. That is the difference between saying nothing and saying
 * something true but general.
 *
 * The family is fetched on open rather than passed in, so this can't be a
 * static-props component the way GlossPopover is.
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

  const { rootSense, family } = splitRootSense(tag.gloss, related, tag.surface);

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

        {tag.gloss ? (
          <p className="text-sm leading-snug text-foreground">{tag.gloss}</p>
        ) : (
          rootSense && (
            <p className="text-sm leading-snug text-muted-foreground">
              <span className="font-arabic text-foreground" dir="rtl">{rootSense.lemma}</span>
              {' — '}
              <span>{rootSense.gloss}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground/80">
                The root&rsquo;s meaning; this form is not glossed on its own.
              </span>
            </p>
          )
        )}

        {tag.root && (
          <div className="space-y-1 border-t border-border/60 pt-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              Root <span className="font-arabic text-sm text-foreground" dir="rtl">{tag.root}</span>
            </p>
            {loadingRelated && <p className="text-xs text-muted-foreground">Loading related words&hellip;</p>}
            {!loadingRelated && family.length > 0 && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                  Other words on this root
                </p>
                <ul className="space-y-1">
                  {family.map((w) => (
                    <li key={w.lemma ?? w.surface} className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="font-arabic text-foreground" dir="rtl">{w.lemma ?? w.surface}</span>
                      <span className="min-w-0 flex-1 truncate text-end text-xs text-muted-foreground">
                        {w.gloss}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!loadingRelated && related && family.length === 0 && (
              <p className="text-xs text-muted-foreground">No other words on this root yet.</p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default BibleWordPopover;
