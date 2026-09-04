import { useState } from 'react';
import { Trash2, Pencil, RefreshCw, Loader2, ArrowLeftRight, RotateCcw } from 'lucide-react';
import type { FlashCard } from '@/lib/spaced-repetition';
import SpeakButton from '@/components/SpeakButton';
import WordDetail from '@/components/WordDetail';
import { dialectView } from '@/lib/dialect';
import { usePreferences } from '@/hooks/usePreferences';

interface DeckCardProps {
  card: FlashCard;
  deck: FlashCard[];
  flipped: boolean;
  onFlip: () => void;
  onDelete: () => void;
  onSwap: () => void;
  onRefreshImage: () => void;
  onEdit: () => void;
  refreshing: boolean;
  swapped: boolean;
}

/**
 * How well a word is holding up, as a dot rather than a wash of colour over
 * the whole card. The old full-card tint fought with the Arabic for
 * attention and made a wall of cards read as a warning rather than a deck.
 */
function health(card: FlashCard): { className: string; label: string } | null {
  if (card.easeFactor >= 2.5 && card.stage2Attempts >= 3 && card.intervalDays >= 7) {
    return { className: 'bg-success', label: 'Solid' };
  }
  if (card.easeFactor < 2.0 || (card.stage2Attempts >= 3 && card.intervalDays <= 1)) {
    return { className: 'bg-destructive', label: 'Shaky' };
  }
  return null;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not scheduled';
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

/**
 * One word in the deck, as a card that turns over.
 *
 * The front is the word and little else, so a screen of them reads as a deck
 * rather than as a table. Everything about the word — its forms, its family,
 * the words around it — is on the back, along with the actions, which keeps
 * the front from filling up with controls nobody is looking at.
 */
const DeckCard = ({
  card, deck, flipped, onFlip, onDelete, onSwap, onRefreshImage, onEdit,
  refreshing, swapped,
}: DeckCardProps) => {
  const { dialect } = usePreferences();
  const view = dialectView(card, dialect);
  const state = health(card);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Buttons on the back must not turn the card back over on their way.
  const act = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="perspective-1000 h-64">
      <div
        className={`preserve-3d flip-face relative h-full w-full transition-transform duration-500 ${
          flipped ? 'rotate-y-180' : ''
        }`}
      >
        {/* Front */}
        <button
          type="button"
          onClick={onFlip}
          aria-hidden={flipped}
          tabIndex={flipped ? -1 : 0}
          className="backface-hidden absolute inset-0 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card p-4 text-center flashcard-shadow transition-shadow hover:flashcard-shadow-hover"
        >
          {state && (
            <span
              className={`absolute end-3 top-3 h-2 w-2 rounded-full ${state.className}`}
              title={state.label}
            />
          )}

          {card.imageUrl && (
            <img
              src={card.imageUrl}
              alt=""
              className="h-16 w-16 rounded-xl object-cover"
              loading="lazy"
            />
          )}

          <p className="font-arabic text-3xl font-bold leading-snug text-foreground" dir="rtl">
            {view.headline}
          </p>

          {card.english && (
            <p className="line-clamp-2 text-sm text-muted-foreground">{card.english}</p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
            {card.root && (
              <span className="font-arabic text-[13px] font-semibold text-primary" dir="rtl">
                {card.root}
              </span>
            )}
            {card.verbForm && (
              <span className="font-medium text-primary/80">Form {card.verbForm}</span>
            )}
          </div>

          <span className="absolute bottom-3 flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <RotateCcw className="h-3 w-3" />
            Tap for forms
          </span>
        </button>

        {/* Back */}
        <div
          aria-hidden={!flipped}
          className="backface-hidden rotate-y-180 absolute inset-0 flex flex-col rounded-2xl border border-primary/40 bg-card flashcard-shadow"
        >
          {/* A div, not a button: SpeakButton is itself a button, and a button
              inside a button is invalid HTML — the parser closes the outer one
              early and the header falls apart. The flip target is its own
              element alongside the speaker instead. */}
          <div className="flex items-center gap-1 border-b border-border/60 px-3 py-2">
            <button
              type="button"
              onClick={onFlip}
              tabIndex={flipped ? 0 : -1}
              title="Turn back over"
              className="flex min-w-0 flex-1 items-center gap-1.5 text-start"
            >
              <RotateCcw className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate font-arabic text-lg font-bold text-foreground" dir="rtl">
                {view.headline}
              </span>
            </button>
            <SpeakButton word={view.spoken} size={14} />
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatDate(card.nextReviewDate)}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            <WordDetail card={card} deck={deck} />
            {!card.root && !card.companionForms?.length && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                This word has not been tagged yet, so there are no forms to show.
              </p>
            )}
          </div>

          <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
            <button
              onClick={act(onSwap)}
              title="Swap Arabic and English"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
            <button
              onClick={act(onRefreshImage)}
              disabled={refreshing}
              title="Find a new image"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
            <button
              onClick={act(onEdit)}
              title="Edit"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </button>

            {swapped && <span className="text-[11px] font-medium text-success">Swapped</span>}

            {/* Deleting a card loses its review history, so it asks first. */}
            {confirmingDelete ? (
              <span className="ms-auto flex items-center gap-1">
                <button
                  onClick={act(() => setConfirmingDelete(false))}
                  className="rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={act(onDelete)}
                  className="rounded-lg bg-destructive px-2 py-1 text-[11px] font-semibold text-destructive-foreground"
                >
                  Delete
                </button>
              </span>
            ) : (
              <button
                onClick={act(() => setConfirmingDelete(true))}
                title="Delete"
                className="ms-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeckCard;
