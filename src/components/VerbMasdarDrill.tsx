import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, Check, X } from 'lucide-react';
import { FlashCard } from '@/lib/spaced-repetition';
import { normalizeArabic } from '@/lib/arabic-normalize';
import SpeakButton from '@/components/SpeakButton';

interface VerbMasdarDrillProps {
  cards: FlashCard[];
  onBack: () => void;
}

interface DrillItem {
  prompt: FlashCard;
  answer: FlashCard;
  direction: 'verb-to-masdar' | 'masdar-to-verb';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const VerbMasdarDrill = ({ cards, onBack }: VerbMasdarDrillProps) => {
  const byId = useMemo(() => {
    const m = new Map<string, FlashCard>();
    cards.forEach((c) => m.set(c.id, c));
    return m;
  }, [cards]);

  const items = useMemo<DrillItem[]>(() => {
    const seen = new Set<string>();
    const out: DrillItem[] = [];
    for (const card of cards) {
      if (!card.pairedWordId || !card.wordType) continue;
      const pair = byId.get(card.pairedWordId);
      if (!pair) continue;
      const key = [card.id, pair.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      const verb = card.wordType === 'verb' ? card : pair.wordType === 'verb' ? pair : null;
      const masdar = card.wordType === 'masdar' ? card : pair.wordType === 'masdar' ? pair : null;
      if (!verb || !masdar) continue;
      // Randomize direction per pair
      if (Math.random() < 0.5) {
        out.push({ prompt: verb, answer: masdar, direction: 'verb-to-masdar' });
      } else {
        out.push({ prompt: masdar, answer: verb, direction: 'masdar-to-verb' });
      }
    }
    return shuffle(out);
  }, [cards, byId]);

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
        <h2 className="text-xl font-bold text-foreground">Verb ↔ Masdar Drill</h2>
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <p className="text-foreground font-medium">No paired verbs and masdars found.</p>
          <p className="text-sm text-muted-foreground">
            Run <span className="font-semibold">Auto-Tag Verb Forms</span> from the home screen to
            pair verbs with their masdars.
          </p>
        </div>
      </div>
    );
  }

  const current = items[index];
  const done = index >= items.length;

  const handleSubmit = () => {
    if (!input.trim() || feedback) return;
    const isCorrect = normalizeArabic(input) === normalizeArabic(current.answer.word);
    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
  };

  const handleNext = () => {
    setIndex((i) => i + 1);
  };

  const handleRestart = () => {
    setIndex(0);
    setScore({ correct: 0, total: 0 });
  };

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

  const promptLabel = current.direction === 'verb-to-masdar' ? 'Verb' : 'Masdar';
  const answerLabel = current.direction === 'verb-to-masdar' ? 'masdar' : 'verb';

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

      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {promptLabel} {current.prompt.verbForm ? `· Form ${current.prompt.verbForm}` : ''}
        </p>
        <div className="flex items-center justify-center gap-2" dir="rtl">
          <p className="text-3xl font-amiri text-foreground">{current.prompt.word}</p>
          <SpeakButton word={current.prompt.word} size={20} autoSpeak />
        </div>
        {current.prompt.english && (
          <p className="text-sm text-muted-foreground">{current.prompt.english}</p>
        )}
        <p className="text-xs text-muted-foreground pt-1">Type the {answerLabel}</p>
      </div>

      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (feedback ? handleNext() : handleSubmit())}
        disabled={!!feedback}
        dir="rtl"
        className={`w-full p-3 text-2xl font-amiri text-center rounded-xl border bg-background transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
          feedback === 'correct'
            ? 'border-success bg-success/5 text-success'
            : feedback === 'incorrect'
            ? 'border-destructive bg-destructive/5 text-destructive'
            : 'border-input'
        }`}
        placeholder="اكتب الإجابة..."
      />

      {feedback && (
        <div className="rounded-xl bg-muted/50 p-3 text-center space-y-2" dir="rtl">
          <div className="flex items-center justify-center gap-2">
            {feedback === 'correct' ? (
              <Check className="w-5 h-5 text-success" />
            ) : (
              <X className="w-5 h-5 text-destructive" />
            )}
            <p className="text-sm text-muted-foreground">Correct answer:</p>
          </div>
          <div className="flex items-center justify-center gap-2">
            <p className="text-2xl font-amiri text-foreground">{current.answer.word}</p>
            <SpeakButton word={current.answer.word} size={18} autoSpeak />
          </div>
          {current.answer.english && (
            <p className="text-xs text-muted-foreground">{current.answer.english}</p>
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

export default VerbMasdarDrill;
