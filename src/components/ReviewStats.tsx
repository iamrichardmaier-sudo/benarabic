import { useEffect, useMemo, useState } from 'react';
import BackButton from '@/components/BackButton';
import SpeakButton from '@/components/SpeakButton';
import { fetchReviewLog, type ReviewEntry } from '@/lib/review-log';
import { dailyCounts, forecast, leeches, lowEase, retention } from '@/lib/review-stats';
import { getDueCards, type FlashCard } from '@/lib/spaced-repetition';
import { dialectView } from '@/lib/dialect';
import { usePreferences } from '@/hooks/usePreferences';

interface ReviewStatsProps {
  cards: FlashCard[];
  userId?: string;
  onBack: () => void;
  /** Go through these cards again as a practice run. */
  onRelearn?: (cardIds: string[]) => void;
}

interface Bar {
  /** Said in full when the bar is pointed at: "Tue 3 Nov". */
  label: string;
  value: number;
  /** A second fact for the readout: "5 forgotten". */
  detail?: string;
}

const dayLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * One series of bars. A readout above the plot names the bar under the
 * pointer (or the finger), since thirty bars cannot each carry a label.
 */
const Bars = ({ bars, unit, summary }: { bars: Bar[]; unit: string; summary: string }) => {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...bars.map((b) => b.value));
  const shown = active !== null ? bars[active] : null;
  return (
    <div>
      <p className="h-5 text-xs text-muted-foreground" aria-live="polite">
        {shown ? (
          <>
            <span className="font-medium text-foreground">{shown.label}</span> · {shown.value} {unit}
            {shown.detail ? ` · ${shown.detail}` : ''}
          </>
        ) : (
          summary
        )}
      </p>
      <div
        role="img"
        aria-label={`${summary}. Highest: ${max} ${unit}.`}
        className="relative mt-1 flex h-28 items-end gap-[2px] border-b border-border"
        onMouseLeave={() => setActive(null)}
      >
        <span className="pointer-events-none absolute start-0 top-0 text-[10px] tabular-nums text-muted-foreground/70">{max}</span>
        {bars.map((b, i) => (
          <button
            key={i}
            type="button"
            title={`${b.label}: ${b.value} ${unit}`}
            aria-label={`${b.label}: ${b.value} ${unit}`}
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(i)}
            className="group flex h-full min-w-0 flex-1 items-end focus:outline-none"
          >
            <span
              className={`block w-full rounded-t-[4px] transition-colors ${
                active === i ? 'bg-foreground' : 'bg-primary group-focus-visible:bg-foreground'
              }`}
              style={{ height: b.value === 0 ? 0 : `${Math.max(3, (b.value / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground/80">
        <span>{bars[0]?.label}</span>
        <span>{bars[bars.length - 1]?.label}</span>
      </div>
    </div>
  );
};

const Tile = ({ figure, label, note }: { figure: string; label: string; note?: string }) => (
  <div className="rounded-2xl border border-border bg-card p-4">
    <p className="text-2xl font-bold tabular-nums text-foreground">{figure}</p>
    <p className="text-sm text-foreground">{label}</p>
    {note && <p className="text-xs text-muted-foreground">{note}</p>}
  </div>
);

/**
 * What the review history says: how much is remembered, how much work is
 * coming, and which words keep slipping.
 *
 * The history starts the day this screen shipped, so for the first weeks the
 * hard-words list leans on what the scheduler already knew (a card's ease);
 * as answers accumulate it becomes a count of real misses.
 */
const ReviewStats = ({ cards, userId, onBack, onRelearn }: ReviewStatsProps) => {
  const { dialect } = usePreferences();
  const [entries, setEntries] = useState<ReviewEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setEntries([]);
      return;
    }
    fetchReviewLog(userId).then((e) => {
      if (!cancelled) setEntries(e);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const stats = useMemo(() => {
    const log = entries ?? [];
    const days = dailyCounts(log, 30);
    return {
      retention: retention(log, 30),
      days,
      answers: days.reduce((n, d) => n + d.total, 0),
      ahead: forecast(cards, 14),
      slipping: leeches(log, cards),
      hard: lowEase(cards, 15),
    };
  }, [entries, cards]);

  const due = getDueCards(cards).length;
  const known = cards.filter((c) => c.learningStage === 'graduated').length;
  const rate = stats.retention.rate;
  const slipping = stats.slipping.slice(0, 15);
  // Before there is enough history to count misses, name what the scheduler has found hard.
  const fallback = slipping.length === 0 ? stats.hard : [];
  const listed = slipping.length > 0 ? slipping.map((l) => l.card) : fallback;

  return (
    <div className="space-y-5">
      <BackButton onClick={onBack} label="Learn" />
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Progress</h1>
        <p className="text-sm text-muted-foreground">What you remember, what is coming, and what keeps slipping.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          figure={rate === null ? '—' : `${Math.round(rate * 100)}%`}
          label="Remembered"
          note={rate === null ? 'No reviews recorded yet' : `of ${stats.retention.reviews} reviews, 30 days`}
        />
        <Tile figure={String(stats.answers)} label="Answers" note="last 30 days" />
        <Tile figure={String(due)} label="Due now" />
        <Tile figure={String(known)} label="Words learned" note={`of ${cards.length} in your deck`} />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Answers a day</h2>
        {entries === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : stats.answers === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            The history starts now: every card you grade from here on is counted.
          </p>
        ) : (
          <Bars
            unit="answers"
            summary="Last 30 days"
            bars={stats.days.map((d) => ({
              label: dayLabel(d.day),
              value: d.total,
              detail: d.forgotten ? `${d.forgotten} forgotten` : undefined,
            }))}
          />
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Reviews coming</h2>
        <Bars
          unit="cards due"
          summary="Next 14 days; today includes anything overdue"
          bars={stats.ahead.map((d, i) => ({ label: i === 0 ? 'Today' : dayLabel(d.day), value: d.due }))}
        />
      </section>

      <section className="space-y-2">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Words that keep slipping</h2>
            <p className="text-xs text-muted-foreground">
              {slipping.length > 0
                ? 'Forgotten three times or more in the last 60 days.'
                : fallback.length > 0
                  ? 'Not enough history to count misses yet. These are the cards the schedule has found hardest.'
                  : 'None. Nothing has been forgotten three times in the last 60 days.'}
            </p>
          </div>
          {onRelearn && listed.length > 0 && (
            <button
              onClick={() => onRelearn(listed.map((c) => c.id))}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-all active:scale-95"
            >
              Relearn these
            </button>
          )}
        </div>
        {listed.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {listed.map((card, i) => {
              const view = dialectView(card, dialect);
              const leech = slipping[i];
              return (
                <li key={card.id} className="flex items-center gap-3 px-4 py-2.5">
                  <SpeakButton word={view.spoken} voice={view.voice} size={16} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-arabic text-lg text-foreground" dir="rtl">{view.headline}</span>
                    <span className="block truncate text-xs text-muted-foreground">{card.english}</span>
                  </span>
                  <span className="shrink-0 text-end text-xs text-muted-foreground">
                    {leech ? (
                      <>
                        <span className="block font-semibold tabular-nums text-foreground">{leech.misses} misses</span>
                        of {leech.asked} times asked
                      </>
                    ) : (
                      card.root && <span className="font-arabic text-sm" dir="rtl">{card.root}</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="px-1 pb-2 text-[11px] text-muted-foreground/70">
        Counted from reviews and practice done in this app. Reviews done in the phone widget are not in the history yet.
      </p>
    </div>
  );
};

export default ReviewStats;
