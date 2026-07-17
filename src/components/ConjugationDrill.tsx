import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, Check, X } from 'lucide-react';
import { FlashCard } from '@/lib/spaced-repetition';
import { normalizeArabicKeepVowels } from '@/lib/arabic-normalize';

interface ConjugationDrillProps {
  cards: FlashCard[];
  onBack: () => void;
}

interface DrillItem {
  root: string;
  verbForm: string;
  pastTense: string;
  presentTense: string;
  masdarForm: string;
}

type FieldResult = 'correct' | 'incorrect';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FIELDS: { key: 'past' | 'present' | 'masdar'; label: string; get: (item: DrillItem) => string }[] = [
  { key: 'past', label: 'Past Tense', get: (i) => i.pastTense },
  { key: 'present', label: 'Present Tense', get: (i) => i.presentTense },
  { key: 'masdar', label: 'Masdar', get: (i) => i.masdarForm },
];

const ConjugationDrill = ({ cards, onBack }: ConjugationDrillProps) => {
  const items = useMemo<DrillItem[]>(() => {
    const seen = new Set<string>();
    const out: DrillItem[] = [];
    for (const card of cards) {
      if (!card.root || !card.verbForm || !card.pastTense || !card.presentTense || !card.masdarForm) continue;
      const key = `${card.root}|${card.verbForm}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        root: card.root,
        verbForm: card.verbForm,
        pastTense: card.pastTense,
        presentTense: card.presentTense,
        masdarForm: card.masdarForm,
      });
    }
    return shuffle(out);
  }, [cards]);

  const [index, setIndex] = useState(0);
  const [inputs, setInputs] = useState({ past: '', present: '', masdar: '' });
  const [results, setResults] = useState<Record<string, FieldResult> | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const firstInputRef = useRef<HTMLInputElement>(null);

  const current = items[index];

  useEffect(() => {
    setInputs({ past: '', present: '', masdar: '' });
    setResults(null);
    firstInputRef.current?.focus();
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
        <h2 className="text-xl font-bold text-foreground">Drill Conjugations</h2>
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <p className="text-foreground font-medium">No tagged verbs found yet.</p>
          <p className="text-sm text-muted-foreground">
            Add some verbs and give auto-tagging a moment to run in the background.
          </p>
        </div>
      </div>
    );
  }

  if (index >= items.length) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <p className="text-foreground font-medium">Drill complete!</p>
          <p className="text-sm text-muted-foreground">
            {score.correct} / {score.total} fully correct
          </p>
        </div>
      </div>
    );
  }

  const handleCheck = () => {
    const next: Record<string, FieldResult> = {};
    let allCorrect = true;
    for (const field of FIELDS) {
      const expected = normalizeArabicKeepVowels(field.get(current));
      const typed = normalizeArabicKeepVowels(inputs[field.key]);
      const ok = expected === typed;
      next[field.key] = ok ? 'correct' : 'incorrect';
      if (!ok) allCorrect = false;
    }
    setResults(next);
    setScore((s) => ({ correct: s.correct + (allCorrect ? 1 : 0), total: s.total + 1 }));
  };

  const handleNext = () => setIndex((i) => i + 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-sm text-muted-foreground">{index + 1} / {items.length}</span>
      </div>

      <h2 className="text-xl font-bold text-foreground">Drill Conjugations</h2>

      <div className="rounded-2xl bg-card flashcard-shadow border border-border/50 p-6 flex flex-col items-center justify-center gap-2">
        <p className="text-[40px] font-bold text-foreground font-arabic" dir="rtl">{current.root}</p>
        <p className="text-sm text-muted-foreground">Form {current.verbForm}</p>
      </div>

      <div className="space-y-3">
        {FIELDS.map((field) => (
          <div key={field.key} className="space-y-1">
            <label className="text-sm text-muted-foreground font-medium">{field.label}</label>
            <input
              ref={field.key === 'past' ? firstInputRef : undefined}
              type="text"
              value={inputs[field.key]}
              onChange={(e) => setInputs((v) => ({ ...v, [field.key]: e.target.value }))}
              disabled={!!results}
              dir="rtl"
              className={`w-full font-arabic text-2xl bg-card border rounded-xl px-4 py-2.5 text-foreground focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:opacity-80 ${
                results
                  ? results[field.key] === 'correct'
                    ? 'border-success'
                    : 'border-destructive'
                  : 'border-border'
              }`}
            />
            {results && results[field.key] === 'incorrect' && (
              <p className="text-sm text-success font-arabic flex items-center gap-1.5" dir="rtl">
                <Check className="w-3.5 h-3.5 flex-shrink-0" />
                {field.get(current)}
              </p>
            )}
          </div>
        ))}
      </div>

      {!results ? (
        <button
          onClick={handleCheck}
          disabled={!inputs.past.trim() || !inputs.present.trim() || !inputs.masdar.trim()}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 disabled:opacity-40"
        >
          Check Answer
        </button>
      ) : (
        <button
          onClick={handleNext}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {Object.values(results).every((r) => r === 'correct') ? (
            <>
              <Check className="w-4 h-4" /> Correct — Continue
            </>
          ) : (
            <>
              <X className="w-4 h-4" /> Continue
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default ConjugationDrill;
