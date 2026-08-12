import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, Check, X } from 'lucide-react';
import { FlashCard } from '@/lib/spaced-repetition';
import { normalizeArabic } from '@/lib/arabic-normalize';
import { useDrillKeyboard } from '@/hooks/useDrillKeyboard';

interface PrepositionDrillProps {
  cards: FlashCard[];
  onBack: () => void;
}

interface DrillItem {
  card: FlashCard;
  before: string;
  after: string;
}

const BLANK = '___';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PrepositionDrill = ({ cards, onBack }: PrepositionDrillProps) => {
  const items = useMemo<DrillItem[]>(() => {
    const seen = new Set<string>();
    const out: DrillItem[] = [];
    for (const card of cards) {
      if (!card.fixedPreposition || !card.prepositionSentence) continue;
      if (!card.prepositionSentence.includes(BLANK)) continue;
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      const [before, after] = card.prepositionSentence.split(BLANK);
      out.push({ card, before, after: after ?? '' });
    }
    return shuffle(out);
  }, [cards]);

  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput('');
    setFeedback(null);
    inputRef.current?.focus();
  }, [index]);

  // Items can be empty, so everything here guards on `current` rather than
  // assume it exists — this all has to run before the empty-state return
  // below, or the hook call after it would run conditionally.
  const current = items[index];

  const handleSubmit = () => {
    if (!current || !input.trim() || feedback) return;
    const isCorrect = normalizeArabic(input) === normalizeArabic(current.card.fixedPreposition ?? '');
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
  };

  const handleNext = () => setIndex((i) => i + 1);
  const handleRestart = () => {
    setIndex(0);
    setScore({ correct: 0, total: 0 });
  };

  /** Space, while wrong: accept it anyway — a typo or dialectal variant the grader missed. */
  const handleOverride = () => {
    if (feedback !== 'incorrect') return;
    setFeedback('correct');
    setScore((s) => ({ ...s, correct: s.correct + 1 }));
  };

  useDrillKeyboard({
    canSubmit: !!input.trim(),
    hasFeedback: !!feedback,
    isWrong: feedback === 'incorrect',
    onSubmit: handleSubmit,
    onOverride: handleOverride,
    onNext: handleNext,
  });

  if (items.length === 0) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h2 className="text-xl font-bold text-foreground">Drill Prepositions</h2>
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <p className="text-foreground font-medium">No preposition-tagged words yet.</p>
          <p className="text-sm text-muted-foreground">
            This drill covers words that always take a specific preposition — نَجَحَ في,
            تَعَرَّفَ على — tagged by hand as they're added.
          </p>
        </div>
      </div>
    );
  }

  const done = index >= items.length;

  if (done) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <div className="text-4xl">
            {score.correct === score.total ? '🎉' : score.correct >= score.total * 0.7 ? '👏' : '📚'}
          </div>
          <h3 className="text-xl font-bold text-foreground">Drill Complete!</h3>
          <p className="text-3xl font-bold text-primary">
            {score.correct} / {score.total}
          </p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleRestart}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium transition-all active:scale-95"
            >
              Retry
            </button>
            <button
              onClick={onBack}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium transition-all active:scale-95"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{index + 1} / {items.length}</span>
        <span>{score.correct} correct</span>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(index / items.length) * 100}%` }}
        />
      </div>

      <h2 className="text-xl font-bold text-foreground">Drill Prepositions</h2>

      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground text-center">
          Fill in the preposition
        </p>

        {/* The sentence itself, read right-to-left, with the blank as an inline input
            so it reads as one continuous line rather than a form field bolted on. */}
        <div
          className="flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-2 font-arabic text-2xl text-foreground"
          dir="rtl"
        >
          <span>{current.before}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={!!feedback}
            dir="rtl"
            aria-label="The missing preposition"
            className={`inline-block w-20 text-center font-arabic text-2xl rounded-lg border-b-2 bg-transparent px-1 pb-0.5 focus:outline-none transition-colors ${
              feedback === 'correct'
                ? 'border-success text-success'
                : feedback === 'incorrect'
                  ? 'border-destructive text-destructive'
                  : 'border-border focus:border-primary'
            }`}
          />
          <span>{current.after}</span>
        </div>

        {current.card.english && (
          <p className="text-sm text-muted-foreground text-center">
            {current.card.word} — {current.card.english}
          </p>
        )}
      </div>

      {feedback && (
        <div className="rounded-xl bg-muted/50 p-3 text-center space-y-1.5" dir="rtl">
          <div className="flex items-center justify-center gap-2">
            {feedback === 'correct' ? (
              <Check className="w-5 h-5 text-success flex-shrink-0" />
            ) : (
              <X className="w-5 h-5 text-destructive flex-shrink-0" />
            )}
            <p className="font-arabic text-lg text-foreground">
              {current.before}
              <span className="text-success font-bold">{current.card.fixedPreposition}</span>
              {current.after}
            </p>
          </div>
          {current.card.prepositionSentenceEn && (
            <p className="text-xs text-muted-foreground" dir="ltr">
              {current.card.prepositionSentenceEn}
            </p>
          )}
          {feedback === 'incorrect' && (
            <p className="text-xs text-muted-foreground pt-1" dir="ltr">
              Close enough? Press <kbd className="font-sans">Space</kbd> to accept it, or{' '}
              <kbd className="font-sans">Enter</kbd> to move on.
            </p>
          )}
        </div>
      )}

      {!feedback ? (
        <button
          onClick={handleSubmit}
          disabled={!input.trim()}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium transition-all active:scale-95 disabled:opacity-40"
        >
          Check
        </button>
      ) : (
        <button
          onClick={handleNext}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium transition-all active:scale-95"
        >
          Next →
        </button>
      )}
    </div>
  );
};

export default PrepositionDrill;
