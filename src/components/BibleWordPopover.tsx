import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { fetchWordsByRoot, fetchFormsOfLemma, splitRootSense } from '@/lib/bible-root-index';
import { Row, Section } from '@/components/WordSections';
import SpeakButton from '@/components/SpeakButton';
import { useDeck } from '@/contexts/DeckContext';
import { wordKey, rootKey } from '@/lib/word-relations';
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

const MAX_DECK = 4;

interface BibleWordPopoverProps {
  text: string;
  tag: BibleWordTag;
}

/**
 * A word met while reading, described the way the flashcard describes one.
 *
 * Same sections in the same order as the card's answer side — what the word
 * is, its other forms, its word family, what you already know on its root —
 * built from the same Row and Section pieces so the two cannot drift apart.
 * A reader who has learned to read the card can read this without relearning
 * anything.
 *
 * Most words in the Book of Mormon carry a root and nothing else: the root was
 * propagated from the Bible, the vowels were not, so no gloss could be
 * borrowed honestly. Those lead with the meaning of the root, labelled as the
 * root's and not the word's — the difference between saying nothing and saying
 * something true but general.
 */
const BibleWordPopover = ({ text, tag }: BibleWordPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [related, setRelated] = useState<BibleWordTag[] | null>(null);
  const [forms, setForms] = useState<string[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const deck = useDeck();

  const handleOpen = () => {
    setOpen(true);
    if (related !== null || loadingRelated) return;

    if (tag.root) {
      setLoadingRelated(true);
      fetchWordsByRoot(tag.root, tag.surface)
        .then(setRelated)
        .catch((err) => {
          console.error('Could not load related words:', err);
          setRelated([]);
        })
        .finally(() => setLoadingRelated(false));
    }
    // Its own inflections, which only exist for a word the corpus has named.
    if (tag.lemma) {
      fetchFormsOfLemma(tag.lemma, tag.surface)
        .then(setForms)
        .catch(() => setForms([]));
    }
  };

  const { rootSense, family } = splitRootSense(tag.gloss, related, tag.surface);

  // Cards already in the deck on this root — the same "you know this one
  // already" the flashcard shows, from the reader's side.
  const named = new Set([wordKey(tag.surface), ...family.map((f) => wordKey(f.surface))]);
  const key = rootKey(tag.root);
  const inDeck = key
    ? deck
        .filter((c) => rootKey(c.root) === key && !named.has(wordKey(c.wordVoweled || c.word)))
        .slice(0, MAX_DECK)
    : [];

  const posLabel = tag.pos ? POS_LABELS[tag.pos] ?? tag.pos : undefined;
  const meta = [tag.root, tag.verbForm ? `Form ${tag.verbForm}` : null, posLabel].filter(Boolean) as string[];
  const headline = tag.lemma ?? tag.surface;

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
        className="max-h-[70vh] w-80 space-y-2.5 overflow-y-auto"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-2">
            <p className="font-arabic text-2xl font-bold text-foreground" dir="rtl">
              {headline}
            </p>
            <SpeakButton word={headline} size={16} />
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

          {meta.length > 0 && (
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[13px] font-semibold text-primary">
              {meta.map((bit, i) => (
                <span key={bit} className="flex items-center gap-2">
                  {i > 0 && <span className="text-muted-foreground/50">·</span>}
                  <span
                    className={i === 0 && tag.root ? 'font-arabic text-[15px]' : ''}
                    dir={i === 0 && tag.root ? 'rtl' : undefined}
                  >
                    {bit}
                  </span>
                </span>
              ))}
            </p>
          )}
        </div>

        {forms.length > 0 && (
          <Section title="Its other forms">
            {forms.map((form) => (
              <Row key={form} label="In the text" value={form} />
            ))}
          </Section>
        )}

        {family.length > 0 && (
          <Section title="Word family">
            {family.map((w) => (
              <Row key={w.lemma ?? w.surface} label={w.gloss ?? ''} value={w.lemma ?? w.surface} />
            ))}
          </Section>
        )}

        {inDeck.length > 0 && (
          <Section title="Same root in your deck">
            {inDeck.map((c) => (
              <Row key={c.id} label={c.english ?? ''} value={c.wordVoweled || c.word} />
            ))}
          </Section>
        )}

        {loadingRelated && family.length === 0 && (
          <p className="text-xs text-muted-foreground">Loading related words&hellip;</p>
        )}
        {!loadingRelated && related && family.length === 0 && !rootSense && tag.root && (
          <p className="text-xs text-muted-foreground">No other words on this root yet.</p>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default BibleWordPopover;
