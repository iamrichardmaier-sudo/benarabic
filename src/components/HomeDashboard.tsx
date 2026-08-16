import { Flame, BookOpen, Layers, GraduationCap, Plus, ChevronRight } from 'lucide-react';
import { currentStreak } from '@/lib/streak';
import { useBibleBooks } from '@/hooks/useBibleBooks';

interface HomeDashboardProps {
  userId?: string;
  dueCount: number;
  learnCount: number;
  deckSize: number;
  onReview: () => void;
  onLearn: () => void;
  onAddWords: () => void;
  onContinueReading: (bookCode: string, chapter: number) => void;
  onBrowseLibrary: () => void;
}

const BOOK_KEY = 'arabic-flashcards-bible-book';
const CHAPTER_KEY = 'arabic-flashcards-bible-chapter';

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
  userId, dueCount, learnCount, deckSize,
  onReview, onLearn, onAddWords, onContinueReading, onBrowseLibrary,
}: HomeDashboardProps) => {
  const streak = currentStreak(userId);
  const { books } = useBibleBooks();

  const lastBook = readStored(BOOK_KEY);
  const lastChapter = Number(readStored(CHAPTER_KEY) || '0');
  const resume = lastBook && lastChapter > 0
    ? { code: lastBook, chapter: lastChapter, name: books?.find((b) => b.code === lastBook)?.name ?? lastBook }
    : null;

  const primary = dueCount > 0
    ? { label: `Review ${dueCount} card${dueCount === 1 ? '' : 's'}`, icon: Layers, action: onReview }
    : learnCount > 0
      ? { label: `Learn ${learnCount} new word${learnCount === 1 ? '' : 's'}`, icon: GraduationCap, action: onLearn }
      : null;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wazn</h1>
          <p className="text-sm text-muted-foreground">Arabic through its roots and patterns.</p>
        </div>
        <div
          className="flex items-center gap-1.5 rounded-2xl border border-border bg-card px-3 py-2 shrink-0"
          title={streak.longest > 0 ? `Longest streak: ${streak.longest} days` : undefined}
        >
          <Flame className={`w-4 h-4 ${streak.current > 0 ? 'text-primary' : 'text-muted-foreground/50'}`} />
          <span className="font-bold text-foreground tabular-nums">{streak.current}</span>
          <span className="text-xs text-muted-foreground">day{streak.current === 1 ? '' : 's'}</span>
        </div>
      </div>

      {/* The single most useful next action, chosen for the user. */}
      {primary && (
        <button
          onClick={primary.action}
          className="w-full flex items-center justify-between gap-3 rounded-2xl bg-primary text-primary-foreground px-5 py-4 font-semibold transition-all active:scale-95"
        >
          <span className="flex items-center gap-2.5">
            <primary.icon className="w-5 h-5" />
            {primary.label}
          </span>
          <ChevronRight className="w-5 h-5 opacity-80" />
        </button>
      )}

      {resume && (
        <button
          onClick={() => onContinueReading(resume.code, resume.chapter)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-start transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-primary shrink-0" />
            <span className="min-w-0">
              <span className="block text-xs text-muted-foreground">Continue reading</span>
              <span className="block font-semibold text-foreground truncate">
                {resume.name} {resume.chapter}
              </span>
            </span>
          </span>
          <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
        </button>
      )}

      <section className="space-y-2">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">Flashcards</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card border border-border p-4 text-center space-y-0.5">
            <p className="text-2xl font-bold text-foreground tabular-nums">{learnCount}</p>
            <p className="text-xs text-muted-foreground">to learn</p>
          </div>
          <div className="rounded-2xl bg-card border border-border p-4 text-center space-y-0.5">
            <p className="text-2xl font-bold text-foreground tabular-nums">{dueCount}</p>
            <p className="text-xs text-muted-foreground">to review</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onLearn}
            disabled={learnCount === 0}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary text-secondary-foreground py-3 text-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <GraduationCap className="w-4 h-4" />
            Learn
          </button>
          <button
            onClick={onAddWords}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-secondary text-secondary-foreground py-3 text-sm font-semibold transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Add words
          </button>
        </div>
      </section>

      <button
        onClick={onBrowseLibrary}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-start transition-colors hover:bg-muted/40"
      >
        <span className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-primary" />
          <span>
            <span className="block font-semibold text-foreground">Library</span>
            <span className="block text-xs text-muted-foreground">The Bible, articles, and more</span>
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </button>

      {deckSize === 0 && (
        <p className="text-sm text-muted-foreground text-center px-4">
          Your deck is empty. Add a few words to get started, or read something in the Library and
          tap any word you don't know.
        </p>
      )}
    </div>
  );
};

export default HomeDashboard;
