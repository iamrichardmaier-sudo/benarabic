import { Flame, Snowflake, BookOpen, Layers, GraduationCap, ChevronRight, RotateCcw, LibraryBig, Check, type LucideIcon } from 'lucide-react';
import { today } from '@/lib/streak';
import { useStreak, useTodayXp } from '@/hooks/useStreak';
import { usePreferences } from '@/hooks/usePreferences';
import GoalRing from '@/components/levels/GoalRing';
import { useProgress } from '@/hooks/useProgress';
import { progressFor, titleFor } from '@/lib/levels';
import { useBibleBooks } from '@/hooks/useBibleBooks';
import HomeDeckShelves from '@/components/decks/HomeDeckShelves';
import DailyAudios from '@/components/daily-audio/DailyAudios';
import HomeDesktopColumns from '@/components/HomeDesktopColumns';
import Illustration from '@/components/Illustration';
import { DailyChallengeCard } from '@/components/DailyChallenge';
import type { LearnDestination } from '@/components/LearnHub';

interface HomeDashboardProps {
  userId?: string;
  /** Opens Settings at the level and background picker. */
  onOpenLevel?: () => void;
  dueCount: number;
  /** The next batch waiting on its gap, when nothing is due this minute. */
  nextWave?: { at: Date; count: number } | null;
  learnCount: number;
  deckSize: number;
  /** How many words were learned in the last week. */
  recentCount?: number;
  /** Run those words again, without touching their schedule. */
  onPractice?: () => void;
  onReview: () => void;
  onLearn: () => void;
  /** Opens the deck shelf, which is where building your own starts too. */
  onBrowseDecks: () => void;
  onContinueReading: (bookCode: string, chapter: number) => void;
  onBrowseLibrary: () => void;
  /** Desktop only: a drill or memorization tool tapped in the Practice column. */
  onSelectPractice: (destination: LearnDestination) => void;
  /** Opens today's translation challenge. */
  onOpenChallenge?: () => void;
}

interface Step {
  key: 'review' | 'learn' | 'read';
  icon: LucideIcon;
  title: string;
  detail: string;
  /** Null when there is nothing to do here right now. */
  action: (() => void) | null;
  done: boolean;
}

const BOOK_KEY = 'arabic-flashcards-bible-book';
const CHAPTER_KEY = 'arabic-flashcards-bible-chapter';

/** The local date `n` days from today. */
function dayOffset(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return today(d);
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * The first screen: answers "what should I do next, and how close am I to my
 * goal?" without making the user go looking. Everything here is a shortcut into
 * work that lives elsewhere — Home owns no functionality of its own.
 */
const HomeDashboard = ({
  userId, dueCount, nextWave, learnCount, deckSize,
  recentCount = 0, onPractice,
  onReview, onLearn, onBrowseDecks, onContinueReading, onBrowseLibrary, onSelectPractice, onOpenLevel, onOpenChallenge,
}: HomeDashboardProps) => {
  const streak = useStreak(userId);
  const todayXp = useTodayXp();
  const { dailyGoal } = usePreferences();
  // Mention a freeze only while it is news: days covered yesterday or the day before.
  const recentFrozen = streak.current > 0 ? streak.frozen.filter((d) => d >= dayOffset(-2)) : [];
  const freezeNote =
    recentFrozen.length === 0 ? null
      : recentFrozen.length === 1
        ? `A streak freeze covered ${recentFrozen[0] === dayOffset(-1) ? 'yesterday' : 'a missed day'}, so your streak is safe.`
        : `Streak freezes covered ${recentFrozen.length} missed days, so your streak is safe.`;
  const level = progressFor(useProgress().xp);
  const { books } = useBibleBooks();

  const lastBook = readStored(BOOK_KEY);
  const lastChapter = Number(readStored(CHAPTER_KEY) || '0');
  const resume = lastBook && lastChapter > 0
    ? { code: lastBook, chapter: lastChapter, name: books?.find((b) => b.code === lastBook)?.name ?? lastBook }
    : null;

  // An empty queue that is only empty for another hour should say so, rather
  // than reading as "you're done" or as the app being broken.
  const waveLabel =
    dueCount === 0 && nextWave
      ? `${nextWave.count} card${nextWave.count === 1 ? '' : 's'} come${nextWave.count === 1 ? 's' : ''} back at ${nextWave.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
      : null;

  /**
   * Today, as three steps in the order they are worth doing: what the schedule
   * is asking for, then new words, then reading. The first step with work in
   * it is the highlighted one, so "what should I do next?" is answered by
   * looking, and a finished step says so instead of disappearing.
   */
  const steps: Step[] = [
    dueCount > 0
      ? { key: 'review', icon: Layers, title: `Review ${dueCount} card${dueCount === 1 ? '' : 's'}`, detail: 'Due today', action: onReview, done: false }
      : { key: 'review', icon: Layers, title: 'Reviews done', detail: waveLabel ?? (deckSize > 0 ? 'Nothing else is due today' : 'Cards you learn will come back here'), action: null, done: deckSize > 0 },
    deckSize === 0
      ? { key: 'learn', icon: LibraryBig, title: 'Pick your first deck', detail: 'A ready-made set of words to start learning', action: onBrowseDecks, done: false }
      : learnCount > 0
        ? { key: 'learn', icon: GraduationCap, title: `Learn new words`, detail: `${learnCount} waiting`, action: onLearn, done: false }
        : { key: 'learn', icon: LibraryBig, title: 'Add new words', detail: 'Nothing new waiting. Browse decks for more', action: onBrowseDecks, done: false },
    resume
      ? { key: 'read', icon: BookOpen, title: `Continue ${resume.name} ${resume.chapter}`, detail: 'Pick up where you stopped reading', action: () => onContinueReading(resume.code, resume.chapter), done: false }
      : { key: 'read', icon: BookOpen, title: 'Read something', detail: 'Scripture or any article, every word tappable', action: onBrowseLibrary, done: false },
  ];
  const nextKey = steps.find((st) => st.action && !st.done)?.key;

  const summary = deckSize === 0
    ? 'Start with a deck of words, or read something.'
    : dueCount > 0 || learnCount > 0
      ? [dueCount > 0 && `${dueCount} to review`, learnCount > 0 && `${learnCount} new waiting`].filter(Boolean).join(' · ')
      : 'All caught up.';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          {/* "Today", not the app's name again: the header already says Wazn. */}
          <h1 className="text-2xl font-bold text-foreground">Today</h1>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-1.5">
          <div
            className="flex items-center gap-2.5 rounded-2xl border border-border bg-card px-2.5 py-2"
            title={streak.longest > 0 ? `Longest streak: ${streak.longest} days` : undefined}
          >
            <GoalRing value={todayXp} goal={dailyGoal}>
              <Flame className={`w-4 h-4 ${streak.current > 0 ? 'text-primary' : 'text-muted-foreground/60'}`} />
            </GoalRing>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 leading-tight">
                {streak.current > 0 ? (
                  <>
                    <span className="font-bold text-foreground tabular-nums">{streak.current}</span>
                    <span className="text-xs text-muted-foreground">day{streak.current === 1 ? '' : 's'}</span>
                  </>
                ) : (
                  // A big "0 days" greets you with what you haven't done; this
                  // invites the first day instead.
                  <span className="text-xs text-muted-foreground">Start a streak</span>
                )}
                {streak.freezes > 0 && (
                  <span
                    className="ms-0.5 flex items-center gap-0.5 text-xs font-semibold text-info"
                    title={`${streak.freezes} streak freeze${streak.freezes === 1 ? '' : 's'}: each covers one missed day`}
                  >
                    <Snowflake className="h-3 w-3" />
                    {streak.freezes}
                  </span>
                )}
              </p>
              <p className="text-[11px] tabular-nums text-muted-foreground">
                {todayXp >= dailyGoal ? 'Goal met' : `${todayXp} / ${dailyGoal} XP`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLevel}
            aria-label={`Level ${level.level}, ${titleFor(level.level).en}. Open level and backgrounds`}
            className="flex w-full flex-col gap-1 rounded-2xl border border-border bg-card px-3 py-1.5 text-left transition-colors hover:border-primary/50"
          >
            <span className="flex items-baseline justify-between gap-2 text-xs font-semibold text-foreground">
              Level {level.level}
              <span className="font-arabic text-sm text-primary" dir="rtl" lang="ar">{titleFor(level.level).ar}</span>
            </span>
            <span className="block h-1 w-full overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary" style={{ width: `${level.fraction * 100}%` }} />
            </span>
          </button>
        </div>
      </div>

      {freezeNote && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Snowflake className="h-3.5 w-3.5 shrink-0 text-info" />
          {freezeNote}
        </p>
      )}

      {onOpenChallenge && <DailyChallengeCard onOpen={onOpenChallenge} />}

      {deckSize === 0 && (
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
          <Illustration name="empty-deck" eager className="h-24 w-24 shrink-0 rounded-xl object-cover" />
          <p className="text-sm text-muted-foreground">
            Your deck is empty — a blank box of cards waiting for its first words. Pick your first deck below.
          </p>
        </div>
      )}

      <section aria-label="Today" className="overflow-hidden rounded-2xl border border-border bg-card">
        {steps.map((st, i) => {
          const isNext = st.key === nextKey;
          const body = (
            <>
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  st.done
                    ? 'bg-success/15 text-success'
                    : isNext
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-primary/10 text-primary'
                }`}
              >
                {st.done ? <Check className="h-4 w-4" /> : <st.icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold ${isNext ? 'text-primary-foreground' : 'text-foreground'}`}>{st.title}</span>
                <span className={`block text-xs ${isNext ? 'text-primary-foreground/85' : 'text-muted-foreground'}`}>{st.detail}</span>
              </span>
              {st.action && (
                <ChevronRight className={`h-5 w-5 shrink-0 ${isNext ? 'text-primary-foreground/80' : 'text-muted-foreground'}`} />
              )}
            </>
          );
          const cls = `flex w-full items-center gap-3 px-4 py-3.5 text-start ${i > 0 ? 'border-t border-border' : ''} ${
            isNext ? 'bg-primary' : ''
          }`;
          return st.action ? (
            <button
              key={st.key}
              onClick={st.action}
              className={`${cls} transition-colors ${isNext ? 'hover:bg-primary/90' : 'hover:bg-muted/40'} active:scale-[0.99]`}
            >
              {body}
            </button>
          ) : (
            <div key={st.key} className={cls}>{body}</div>
          );
        })}
      </section>

      {/* Extra practice on this week's words, whether or not they are due.
          Separate from Review because it changes nothing: it is exposure on
          demand, not a review the schedule asked for. */}
      {recentCount > 0 && onPractice && (
        <button
          onClick={onPractice}
          className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-start transition-all active:scale-95 hover:bg-muted/40"
        >
          <RotateCcw className="w-5 h-5 text-primary shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-foreground">
              Practise this week&rsquo;s {recentCount} word{recentCount === 1 ? '' : 's'}
            </span>
            <span className="block text-xs text-muted-foreground">
              Run them again now — your schedule stays as it is
            </span>
          </span>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      )}

      <HomeDeckShelves />
      <DailyAudios />
      <HomeDesktopColumns onSelect={onSelectPractice} />
    </div>
  );
};

export default HomeDashboard;
