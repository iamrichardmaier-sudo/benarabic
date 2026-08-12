import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronLeft, Check, X } from 'lucide-react';
import { FlashCard } from '@/lib/spaced-repetition';
import { normalizeArabicKeepVowels, normalizeArabicIgnoreShortVowels } from '@/lib/arabic-normalize';
import { VERB_FORM_GLOSSES, loadRootMeanings } from '@/lib/morphology';
import GlossPopover from '@/components/GlossPopover';
import { useDrillKeyboard } from '@/hooks/useDrillKeyboard';

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
type Phase = 'select' | 'drill';

/** Conventional ordering; anything unrecognised sorts to the end. */
const FORM_ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Remembered across sessions so the choice doesn't have to be re-made. */
const IGNORE_VOWELS_KEY = 'arabic-flashcards-drill-ignore-short-vowels';
const MASDAR_ONLY_KEY = 'arabic-flashcards-drill-masdar-only';

function readVowelPref(): boolean {
  try {
    return localStorage.getItem(IGNORE_VOWELS_KEY) === 'true';
  } catch {
    return false;
  }
}

function readMasdarOnlyPref(): boolean {
  try {
    return localStorage.getItem(MASDAR_ONLY_KEY) === 'true';
  } catch {
    return false;
  }
}

function compareForms(a: string, b: string): number {
  const ia = FORM_ORDER.indexOf(a);
  const ib = FORM_ORDER.indexOf(b);
  if (ia === -1 && ib === -1) return a.localeCompare(b);
  if (ia === -1) return 1;
  if (ib === -1) return -1;
  return ia - ib;
}

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

const BackLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
  >
    <ChevronLeft className="w-4 h-4" />
    {label}
  </button>
);

const ConjugationDrill = ({ cards, onBack }: ConjugationDrillProps) => {
  // Every verb eligible for drilling, one entry per root + form pair.
  const allItems = useMemo<DrillItem[]>(() => {
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
    return out;
  }, [cards]);

  const countsByForm = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of allItems) counts.set(item.verbForm, (counts.get(item.verbForm) ?? 0) + 1);
    return counts;
  }, [allItems]);

  const availableForms = useMemo(
    () => [...countsByForm.keys()].sort(compareForms),
    [countsByForm],
  );

  const [phase, setPhase] = useState<Phase>('select');
  // null means "untouched", which reads as everything selected — so the common
  // case is a single tap on Start without ticking ten boxes first.
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const selectedForms = picked ?? new Set(availableForms);

  const [ignoreShortVowels, setIgnoreShortVowels] = useState(readVowelPref);
  const [masdarOnly, setMasdarOnly] = useState(readMasdarOnlyPref);
  const [rootMeanings, setRootMeanings] = useState<Record<string, string>>({});
  const [items, setItems] = useState<DrillItem[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    loadRootMeanings()
      .then((meanings) => {
        if (!cancelled) setRootMeanings(meanings);
      })
      .catch((err) => console.error('Root meanings unavailable:', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCount = allItems.filter((i) => selectedForms.has(i.verbForm)).length;

  // Masdar-only mode drills a single field (given the verb, produce its masdar)
  // instead of the full past/present/masdar set.
  const activeFields = masdarOnly ? FIELDS.filter((f) => f.key === 'masdar') : FIELDS;

  const allFieldsCorrect = (r: Record<string, FieldResult>) =>
    Object.values(r).every((v) => v === 'correct');

  // Defined before the early returns below (select phase, drill complete) so
  // the useDrillKeyboard call — a hook — always runs on every render; it
  // no-ops itself via canSubmit/hasFeedback whenever there's no active question.
  const handleCheck = () => {
    if (!current) return;
    const next: Record<string, FieldResult> = {};
    let allCorrect = true;
    const normalize = ignoreShortVowels ? normalizeArabicIgnoreShortVowels : normalizeArabicKeepVowels;
    for (const field of activeFields) {
      const expected = normalize(field.get(current));
      const typed = normalize(inputs[field.key]);
      const ok = expected === typed;
      next[field.key] = ok ? 'correct' : 'incorrect';
      if (!ok) allCorrect = false;
    }
    setResults(next);
    setScore((s) => ({ correct: s.correct + (allCorrect ? 1 : 0), total: s.total + 1 }));
  };

  const handleNext = () => setIndex((i) => i + 1);

  /** Space, while any field is wrong: accept the whole answer anyway. */
  const handleOverrideAll = () => {
    if (!results || allFieldsCorrect(results)) return;
    const next: Record<string, FieldResult> = {};
    for (const field of activeFields) next[field.key] = 'correct';
    setResults(next);
    setScore((s) => ({ ...s, correct: s.correct + 1 }));
  };

  const allInputsFilled = activeFields.every((f) => !!inputs[f.key].trim());

  useDrillKeyboard({
    canSubmit: phase === 'drill' && !!current && !results && allInputsFilled,
    hasFeedback: phase === 'drill' && !!results,
    isWrong: phase === 'drill' && !!results && !allFieldsCorrect(results),
    onSubmit: handleCheck,
    onOverride: handleOverrideAll,
    onNext: handleNext,
  });

  const toggleVowelChecking = () => {
    setIgnoreShortVowels((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(IGNORE_VOWELS_KEY, String(next));
      } catch {
        /* preference just won't persist */
      }
      return next;
    });
  };

  const toggleMasdarOnly = () => {
    setMasdarOnly((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MASDAR_ONLY_KEY, String(next));
      } catch {
        /* preference just won't persist */
      }
      return next;
    });
  };

  const toggleForm = (form: string) => {
    const next = new Set(selectedForms);
    if (next.has(form)) next.delete(form);
    else next.add(form);
    setPicked(next);
  };

  const startDrill = () => {
    setItems(shuffle(allItems.filter((i) => selectedForms.has(i.verbForm))));
    setIndex(0);
    setScore({ correct: 0, total: 0 });
    setInputs({ past: '', present: '', masdar: '' });
    setResults(null);
    setPhase('drill');
  };

  if (allItems.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mb-2">
          <BackLink label="Back" onClick={onBack} />
        </div>
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

  if (phase === 'select') {
    const allSelected = selectedForms.size === availableForms.length;
    return (
      <div className="space-y-4">
        <BackLink label="Back" onClick={onBack} />

        <div className="space-y-1">
          <h2 className="text-xl font-bold text-foreground">Drill Conjugations</h2>
          <p className="text-sm text-muted-foreground">Pick the verb forms you want to practise.</p>
        </div>

        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60">
          {availableForms.map((form) => {
            const count = countsByForm.get(form) ?? 0;
            return (
              <label
                key={form}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
              >
                <input
                  type="checkbox"
                  aria-label={`Form ${form}`}
                  checked={selectedForms.has(form)}
                  onChange={() => toggleForm(form)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="flex-1 font-medium text-foreground">Form {form}</span>
                <span className="text-sm text-muted-foreground">
                  {count} verb{count === 1 ? '' : 's'}
                </span>
              </label>
            );
          })}
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
          <input
            type="checkbox"
            checked={masdarOnly}
            onChange={toggleMasdarOnly}
            className="w-4 h-4 mt-0.5 accent-primary cursor-pointer"
          />
          <span className="flex-1">
            <span className="block font-medium text-foreground">Verb → Masdar only</span>
            <span className="block text-xs text-muted-foreground">
              Skip past and present tense — just see the verb and type its masdar.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 rounded-2xl border border-border bg-card px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
          <input
            type="checkbox"
            checked={ignoreShortVowels}
            onChange={toggleVowelChecking}
            className="w-4 h-4 mt-0.5 accent-primary cursor-pointer"
          />
          <span className="flex-1">
            <span className="block font-medium text-foreground">Don't check short vowels</span>
            <span className="block text-xs text-muted-foreground">
              Grade the letters only, so missing tashkeel isn't marked wrong. Shadda still counts,
              since it's what separates one form from another.
            </span>
          </span>
        </label>

        <div className="flex items-center justify-between">
          <button
            onClick={() => setPicked(allSelected ? new Set<string>() : new Set(availableForms))}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {allSelected ? 'Clear all' : 'Select all'}
          </button>
          <span className="text-sm text-muted-foreground">
            {selectedCount} verb{selectedCount === 1 ? '' : 's'} selected
          </span>
        </div>

        <button
          onClick={startDrill}
          disabled={selectedCount === 0}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 disabled:opacity-40"
        >
          Start Drill
        </button>
      </div>
    );
  }

  if (index >= items.length) {
    return (
      <div className="space-y-4">
        <BackLink label="Back" onClick={onBack} />
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <p className="text-foreground font-medium">Drill complete!</p>
          <p className="text-sm text-muted-foreground">
            {score.correct} / {score.total} fully correct
          </p>
        </div>
        <button
          onClick={() => setPhase('select')}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
        >
          Choose forms
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <BackLink label="Forms" onClick={() => setPhase('select')} />
        <span className="text-sm text-muted-foreground">{index + 1} / {items.length}</span>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">
          {masdarOnly ? 'Verb → Masdar' : 'Drill Conjugations'}
        </h2>
        {ignoreShortVowels && (
          <p className="text-xs text-muted-foreground">Short vowels aren't being checked.</p>
        )}
      </div>

      <div className="rounded-2xl bg-card flashcard-shadow border border-border/50 p-6 flex flex-col items-center justify-center gap-2">
        {masdarOnly ? (
          <>
            <span className="text-[40px] font-bold text-foreground font-arabic" dir="rtl">
              {current.pastTense}
            </span>
            <GlossPopover
              title={current.root}
              subtitle="Root"
              body={
                rootMeanings[current.root] ??
                'No gloss recorded for this root yet — the sense has to be inferred from the words that use it.'
              }
              side="bottom"
              triggerLabel={`What the root ${current.root} means`}
              className="px-2 py-0.5 text-sm text-muted-foreground underline"
            >
              Verb · Form {current.verbForm}
            </GlossPopover>
          </>
        ) : (
          <>
            <GlossPopover
              title={current.root}
              subtitle="Root"
              body={
                rootMeanings[current.root] ??
                'No gloss recorded for this root yet — the sense has to be inferred from the words that use it.'
              }
              side="top"
              triggerLabel={`What the root ${current.root} means`}
              className="px-2 py-1 underline"
            >
              <span className="text-[40px] font-bold text-foreground font-arabic" dir="rtl">
                {current.root}
              </span>
            </GlossPopover>

            {(() => {
              const gloss = current.verbForm ? VERB_FORM_GLOSSES[current.verbForm] : undefined;
              if (!gloss) {
                return <p className="text-sm text-muted-foreground">Form {current.verbForm}</p>;
              }
              return (
                <GlossPopover
                  title={gloss.pattern}
                  subtitle={`Form ${current.verbForm} — ${gloss.summary}`}
                  body={gloss.detail}
                  side="bottom"
                  triggerLabel={`What Form ${current.verbForm} does to a root`}
                  className="px-2 py-0.5 text-sm text-muted-foreground underline"
                >
                  Form {current.verbForm}
                </GlossPopover>
              );
            })()}
          </>
        )}
      </div>

      <div className="space-y-3">
        {activeFields.map((field) => {
          const expected = field.get(current);
          // Character-for-character match, tashkeel included. Lenient grading
          // can call an answer correct while the vowels and tanwin are missing,
          // and those are exactly what the learner still needs to see.
          const typedItExactly =
            normalizeArabicKeepVowels(inputs[field.key]) === normalizeArabicKeepVowels(expected);
          const wrong = results?.[field.key] === 'incorrect';
          const showAnswer = !!results && (wrong || !typedItExactly);

          return (
            <div key={field.key} className="space-y-1">
              <label className="text-sm text-muted-foreground font-medium">{field.label}</label>
              <input
                ref={field.key === activeFields[0].key ? firstInputRef : undefined}
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
              {showAnswer && (
                <p
                  className={`text-sm font-arabic flex items-center gap-1.5 ${wrong ? 'text-success' : 'text-muted-foreground'}`}
                  dir="rtl"
                >
                  <Check className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{expected}</span>
                  {!wrong && (
                    <span className="font-sans text-xs" dir="ltr">
                      full vowelling
                    </span>
                  )}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!results ? (
        <button
          onClick={handleCheck}
          disabled={!allInputsFilled}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 disabled:opacity-40"
        >
          Check Answer
        </button>
      ) : (
        <div className="space-y-2">
          {!allFieldsCorrect(results) && (
            <p className="text-xs text-muted-foreground text-center" dir="ltr">
              Close enough? Press <kbd className="font-sans">Space</kbd> to accept it, or{' '}
              <kbd className="font-sans">Enter</kbd> to move on.
            </p>
          )}
          <button
            onClick={handleNext}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            {allFieldsCorrect(results) ? (
              <>
                <Check className="w-4 h-4" /> Correct — Continue
              </>
            ) : (
              <>
                <X className="w-4 h-4" /> Continue
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ConjugationDrill;
