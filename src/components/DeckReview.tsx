import { useMemo, useState } from 'react';
import { FastForward, Loader2, LogOut, Undo2 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { useRelearnDecks } from '@/hooks/useRelearnDecks';
import type { FlashCard } from '@/lib/spaced-repetition';
import { sectionsByDeck, type RelearnSection } from '@/lib/relearn';
import {
  ADVANCE_DAYS, advanceAsEasy, inRotation, parkAsMastered, reviewCounts, scheduleSnapshot,
} from '@/lib/deck-review';
import { MASTERED_INTERVAL_DAYS } from '@/lib/deck-placement';

interface DeckReviewProps {
  cards: FlashCard[];
  onUpdateCard: (id: string, updates: Partial<FlashCard>) => unknown;
  onBack: () => void;
}

type Action = 'advance' | 'park';

interface Done {
  message: string;
  /** Each changed card's schedule before the action, to put back on Undo. */
  undo: { id: string; before: Partial<FlashCard> }[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * The review schedule, deck by deck.
 *
 * A long review queue is usually a few decks the learner already knows well.
 * Two ways to shorten it, per deck: move it out of the daily review for a
 * month, or advance it as though every review of the next three weeks had been
 * Easy. Either way only cards already in review move, nothing is deleted, and
 * the last action can be undone from here.
 */
const DeckReview = ({ cards, onUpdateCard, onBack }: DeckReviewProps) => {
  const { decks, loading } = useRelearnDecks(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo<RelearnSection[]>(
    () => (decks ? sectionsByDeck(cards, decks) : [{ id: 'all', name: 'All your cards', cards }]),
    [cards, decks],
  );

  /** A few at a time: a deck can be hundreds of cards, one request each. */
  const writeAll = async (writes: { id: string; updates: Partial<FlashCard> }[]) => {
    const BATCH = 10;
    for (let i = 0; i < writes.length; i += BATCH) {
      await Promise.all(writes.slice(i, i + BATCH).map((w) => onUpdateCard(w.id, w.updates)));
    }
  };

  const run = async (section: RelearnSection, action: Action) => {
    setError(null);
    setDone(null);
    const rotation = inRotation(section.cards);
    const plan = rotation.flatMap((card) => {
      const updates = action === 'advance' ? advanceAsEasy(card) : parkAsMastered(card);
      const changed =
        updates !== null &&
        (updates.nextReviewDate !== card.nextReviewDate ||
          updates.intervalDays !== card.intervalDays ||
          (updates.placedAs ?? card.placedAs ?? null) !== (card.placedAs ?? null));
      return changed && updates ? [{ card, updates }] : [];
    });
    if (plan.length === 0) {
      setDone({
        message:
          action === 'advance'
            ? `None of the cards in ${section.name} come due in the next ${ADVANCE_DAYS} days, so there was nothing to move.`
            : `Everything in ${section.name} is already out of review for at least ${MASTERED_INTERVAL_DAYS} days.`,
        undo: [],
      });
      return;
    }

    setBusy(`${section.id}:${action}`);
    try {
      const undo = plan.map((p) => ({ id: p.card.id, before: scheduleSnapshot(p.card) }));
      await writeAll(plan.map((p) => ({ id: p.card.id, updates: p.updates })));
      const left = rotation.length - plan.length;
      setDone({
        message:
          action === 'advance'
            ? `Advanced ${plural(plan.length, 'card')} in ${section.name}, as if every review for ${ADVANCE_DAYS} days had been Easy.` +
              (left > 0 ? ` ${plural(left, 'card')} weren’t due in that time and stayed put.` : '')
            : `Moved ${plural(plan.length, 'card')} in ${section.name} out of review for about ${MASTERED_INTERVAL_DAYS} days.` +
              (left > 0 ? ` ${plural(left, 'card')} were already further out.` : ''),
        undo,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const undo = async () => {
    if (!done || done.undo.length === 0) return;
    setBusy('undo');
    setError(null);
    try {
      await writeAll(done.undo.map((u) => ({ id: u.id, updates: u.before })));
      setDone({ message: `Put ${plural(done.undo.length, 'card')} back as they were.`, undo: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That could not be undone.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full max-w-md lg:max-w-3xl mx-auto space-y-5">
      <BackButton onClick={onBack} label="Learn" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Deck review</h1>
        <p className="text-sm text-muted-foreground">
          Shorten your daily review by moving a deck you know well along. Only cards already in review
          move; nothing is deleted.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-sm text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Advance {ADVANCE_DAYS} days</span> moves each card
          along as if you had rated it Easy every time it came up over the next three weeks.
        </p>
        <p>
          <span className="font-semibold text-foreground">Move out of review</span> takes the deck out of the
          daily review for about {MASTERED_INTERVAL_DAYS} days. It comes back for a check then, and
          words you know walk further out on their own.
        </p>
      </div>

      {done && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-2xl bg-primary/10 px-4 py-3 text-sm text-foreground">
          <span>{done.message}</span>
          {done.undo.length > 0 && (
            <button
              onClick={undo}
              disabled={busy !== null}
              className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary disabled:opacity-50"
            >
              <Undo2 className="h-4 w-4" /> Undo
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      {loading && !decks && <p className="px-1 text-xs text-muted-foreground">Loading your decks…</p>}

      <div className="space-y-3">
        {sections.map((section) => {
          const counts = reviewCounts(section.cards);
          const disabled = busy !== null || counts.inReview === 0;
          return (
            <div key={section.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <div className="space-y-0.5">
                <p className="font-semibold text-foreground">{section.name}</p>
                <p className="text-xs text-muted-foreground">
                  {counts.inReview} in review · {counts.due} due now
                  {counts.learning > 0 ? ` · ${counts.learning} still being learned` : ''}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => run(section, 'advance')}
                  disabled={disabled}
                  aria-label={`Advance ${section.name} ${ADVANCE_DAYS} days`}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy === `${section.id}:advance` ? <Loader2 className="h-4 w-4 animate-spin" /> : <FastForward className="h-4 w-4" />}
                  Advance {ADVANCE_DAYS} days
                </button>
                <button
                  onClick={() => run(section, 'park')}
                  disabled={disabled}
                  aria-label={`Move ${section.name} out of review`}
                  className="inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2 text-sm font-semibold text-foreground disabled:opacity-50"
                >
                  {busy === `${section.id}:park` ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                  Move out of review
                </button>
              </div>
            </div>
          );
        })}
        {sections.length === 0 && (
          <p className="rounded-2xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            No cards yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default DeckReview;
