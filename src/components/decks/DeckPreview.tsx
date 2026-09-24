import { useEffect, useState } from 'react';
import { Loader2, Check, Plus, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import BackButton from '@/components/BackButton';
import DeckIcon from '@/components/decks/DeckIcon';
import WordDetail from '@/components/WordDetail';
import PlacementPicker from '@/components/decks/PlacementPicker';
import { useDeck } from '@/contexts/DeckContext';
import { FOUNDATION_ICON } from '@/lib/deck-icons';
import { fetchDeckWords, wordToCard, type Deck, type Word } from '@/lib/deck-store';
import type { DeckPlacement } from '@/lib/deck-placement';

interface DeckPreviewProps {
  deck: Deck;
  /** True when this deck is already in the learner's Learn section. */
  added: boolean;
  onBack: () => void;
  /** Takes the deck up, with the words starting where `placement` says. */
  onAdd: (placement: DeckPlacement) => void;
  onRemove: () => void;
  /** Present when the viewer owns the deck and can take words out of it. */
  onRemoveWord?: (wordId: string) => Promise<void>;
}

/**
 * What is in a deck, before taking it on.
 *
 * The list stays deliberately plain — one line per word, the Arabic and its
 * meaning — because a wall of roots and plurals is unreadable at a glance.
 * The rest is a hover away on a mouse and a tap away on a phone, which is the
 * natural gesture on each rather than a long-press nobody discovers.
 */
const DeckPreview = ({
  deck, added, onBack, onAdd, onRemove, onRemoveWord,
}: DeckPreviewProps) => {
  const [words, setWords] = useState<Word[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [placement, setPlacement] = useState<DeckPlacement>('learn');
  const deckCards = useDeck();

  useEffect(() => {
    let cancelled = false;
    fetchDeckWords(deck.id)
      .then((w) => {
        if (!cancelled) setWords(w);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the words.');
      });
    return () => {
      cancelled = true;
    };
  }, [deck.id]);

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Decks" />

      <div className="flex items-center gap-3">
        <DeckIcon
          icon={deck.icon}
          iconUrl={deck.iconUrl}
          foundation={deck.icon === FOUNDATION_ICON && !deck.iconUrl}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold text-foreground">{deck.title}</h2>
          <p className="text-xs text-muted-foreground">
            {words ? `${words.length} word${words.length === 1 ? '' : 's'}` : 'Loading…'}
            {deck.status === 'draft' && ' · draft'}
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!added ? (
        <div className="space-y-2">
          <PlacementPicker value={placement} onChange={setPlacement} />
          <button
            onClick={() => onAdd(placement)}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add this deck
          </button>
        </div>
      ) : !confirmRemove ? (
        <div className="space-y-2">
          <p className="flex items-center justify-center gap-1.5 rounded-xl bg-success/10 py-2.5 text-sm font-medium text-success">
            <Check className="h-4 w-4" />
            In your Learn section
          </p>
          <button
            onClick={() => setConfirmRemove(true)}
            className="w-full text-xs text-muted-foreground underline hover:text-foreground"
          >
            Remove this deck
          </button>
        </div>
      ) : (
        <div className="space-y-2 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Remove {deck.title}?</p>
          <p className="text-xs text-muted-foreground">
            Your cards and everything you have learned stay exactly as they are — only the deck
            leaves your Learn section. You can take it up again later and carry on where you
            stopped.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setConfirmRemove(false)}
              className="rounded-xl border border-border py-2 text-sm font-semibold text-foreground"
            >
              Keep it
            </button>
            <button
              onClick={() => {
                setConfirmRemove(false);
                onRemove();
              }}
              className="rounded-xl bg-destructive py-2 text-sm font-semibold text-destructive-foreground"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {words === null && !error && (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {words && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
          {words.map((word) => (
            <div key={word.id} className="flex items-center gap-2 px-3">
              <Popover
                open={openWord === word.id}
                onOpenChange={(o) => setOpenWord(o ? word.id : null)}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onMouseEnter={() => setOpenWord(word.id)}
                    onMouseLeave={() => setOpenWord(null)}
                    className="flex min-w-0 flex-1 items-baseline justify-between gap-3 py-2.5 text-start transition-colors hover:text-primary"
                  >
                    <span className="truncate text-xs text-muted-foreground">
                      {word.english ?? '—'}
                    </span>
                    <span className="font-arabic text-lg text-foreground" dir="rtl">
                      {word.wordVoweled || word.word}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="top"
                  className="max-h-[60vh] w-80 overflow-y-auto"
                  onMouseEnter={() => setOpenWord(word.id)}
                  onMouseLeave={() => setOpenWord(null)}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  {/* The same panel the flashcard shows, so a word does not
                      read differently here than it will when studied. */}
                  <WordDetail card={wordToCard(word)} deck={deckCards} />
                  {word.exampleSentence && (
                    <div className="mt-2 border-t border-border/60 pt-2">
                      <p className="font-arabic text-sm text-foreground" dir="rtl">
                        {word.exampleSentence}
                      </p>
                      {word.exampleSentenceEn && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {word.exampleSentenceEn}
                        </p>
                      )}
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              {onRemoveWord && (
                <button
                  onClick={() => onRemoveWord(word.id)}
                  aria-label={`Remove ${word.word} from this deck`}
                  className="shrink-0 rounded p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {words.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              This deck has no words in it yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default DeckPreview;
