import { useState, useMemo, useEffect, useRef } from 'react';
import { Check, X } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { FlashCard } from '@/lib/spaced-repetition';
import { normalizeArabicKeepVowels, normalizeArabicIgnoreShortVowels } from '@/lib/arabic-normalize';
import { VERB_FORM_GLOSSES, loadRootMeanings } from '@/lib/morphology';
import GlossPopover from '@/components/GlossPopover';
import VerbChartDrill from '@/components/VerbChartDrill';
import { chartable } from '@/lib/verb-chart';
import { baselineFor } from '@/lib/verb-baselines';
import { followsBaseline } from '@/lib/baseline-chart';
import { sortChapterLabels } from '@/lib/chapter-sort';
import type { DeckMembership } from '@/lib/relearn';
import { useDrillKeyboard } from '@/hooks/useDrillKeyboard';

interface ConjugationDrillProps {
  cards: FlashCard[];
  onBack: () => void;
  /**
   * The decks the learner holds and the words in each, so the drill can be
   * narrowed to the verbs of particular decks. Without them (still loading,
   * or no decks) every verb is drilled, as before.
   */
  decks?: DeckMembership[] | null;
}

interface DrillItem {
  root: string;
  verbForm: string;
  pastTense: string;
  presentTense: string;
  masdarForm: string;
  /** The bank words behind this verb, which is what ties it to decks. */
  wordIds: string[];
}

type FieldResult = 'correct' | 'incorrect';
type Phase = 'select' | 'drill' | 'chart';

/** Conventional ordering; anything unrecognised sorts to the end. */
const FORM_ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Remembered across sessions so the choice doesn't have to be re-made. */
const IGNORE_VOWELS_KEY = 'arabic-flashcards-drill-ignore-short-vowels';
const MASDAR_ONLY_KEY = 'arabic-flashcards-drill-masdar-only';
const DECKS_KEY = 'arabic-flashcards-drill-decks';

/** The decks last picked, or null for all of them. */
function readDeckPref(): Set<string> | null {
  try {
    const raw = localStorage.getItem(DECKS_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(ids) && ids.length > 0 ? new Set(ids.filter((x): x is string => typeof x === 'string')) : null;
  } catch {
    return null;
  }
}

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

/** Whether a deck holds any of the words behind a verb. */
const inDeck = (item: DrillItem, deck: DeckMembership) => item.wordIds.some((w) => deck.wordIds.has(w));

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

const ConjugationDrill = ({ cards, onBack, decks = null }: ConjugationDrillProps) => {
  // Every verb eligible for drilling, one entry per root + form pair.
  const allItems = useMemo<DrillItem[]>(() => {
    const byKey = new Map<string, DrillItem>();
    for (const card of cards) {
      if (!card.root || !card.verbForm || !card.pastTense || !card.presentTense || !card.masdarForm) continue;
      const key = `${card.root}|${card.verbForm}`;
      const seen = byKey.get(key);
      if (seen) {
        // A second card for the same verb: it may come from another deck.
        if (card.wordId && !seen.wordIds.includes(card.wordId)) seen.wordIds.push(card.wordId);
        continue;
      }
      byKey.set(key, {
        root: card.root,
        verbForm: card.verbForm,
        pastTense: card.pastTense,
        presentTense: card.presentTense,
        masdarForm: card.masdarForm,
        wordIds: card.wordId ? [card.wordId] : [],
      });
    }
    return [...byKey.values()];
  }, [cards]);

  // Which decks the verbs come from. Only decks holding at least one drillable
  // verb are offered, in chapter order.
  const [deckPick, setDeckPick] = useState<Set<string> | null>(readDeckPref);
  const verbDecks = useMemo(() => {
    const withVerbs = (decks ?? [])
      .map((deck) => ({ deck, count: allItems.filter((i) => inDeck(i, deck)).length }))
      .filter((d) => d.count > 0);
    const order = sortChapterLabels([...new Set(withVerbs.map((d) => d.deck.title))]);
    return withVerbs.sort((a, b) => order.indexOf(a.deck.title) - order.indexOf(b.deck.title));
  }, [decks, allItems]);
  /** The decks in force: the remembered pick, less any deck no longer offered. Null means all. */
  const activeDecks = useMemo(() => {
    if (!deckPick) return null;
    const live = verbDecks.filter((d) => deckPick.has(d.deck.id)).map((d) => d.deck);
    return live.length > 0 ? live : null;
  }, [deckPick, verbDecks]);
  const scopedItems = useMemo(
    () => (activeDecks ? allItems.filter((i) => activeDecks.some((d) => inDeck(i, d))) : allItems),
    [allItems, activeDecks],
  );

  const chooseDecks = (next: Set<string> | null) => {
    const value = next && next.size > 0 ? next : null;
    setDeckPick(value);
    try {
      if (value) localStorage.setItem(DECKS_KEY, JSON.stringify([...value]));
      else localStorage.removeItem(DECKS_KEY);
    } catch {
      /* preference just won't persist */
    }
  };
  const toggleDeck = (id: string) => {
    const next = new Set<string>(activeDecks ? activeDecks.map((d) => d.id) : []);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    chooseDecks(next);
  };

  const countsByForm = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of scopedItems) counts.set(item.verbForm, (counts.get(item.verbForm) ?? 0) + 1);
    return counts;
  }, [scopedItems]);

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

  const selectedItems = scopedItems.filter((i) => selectedForms.has(i.verbForm));
  const selectedCount = selectedItems.length;
  // Charts are derived from the principal parts, and a handful of entries
  // (quadriliterals, passives, phrases) have no paradigm to derive — they are
  // dropped rather than charted wrongly, so the count is worth showing.
  const chartableCount = chartable(selectedItems).length;

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
    setItems(shuffle(scopedItems.filter((i) => selectedForms.has(i.verbForm))));
    setIndex(0);
    setScore({ correct: 0, total: 0 });
    setInputs({ past: '', present: '', masdar: '' });
    setResults(null);
    setPhase('drill');
  };

  const startChart = () => {
    setPhase('chart');
  };

  if (allItems.length === 0) {
    return (
      <div className="space-y-4">
        <div className="mb-2">
          <BackButton label="Learn" onClick={onBack} />
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

  if (phase === 'chart') {
    return (
      <VerbChartDrill
        verbs={selectedItems}
        rootMeanings={rootMeanings}
        ignoreShortVowels={ignoreShortVowels}
        onBack={() => setPhase('select')}
      />
    );
  }

  if (phase === 'select') {
    const allSelected = selectedForms.size === availableForms.length;
    return (
      <div className="space-y-4">
        <BackButton label="Learn" onClick={onBack} />

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

        <div className="space-y-2">
          <button
            onClick={startDrill}
            disabled={selectedCount === 0}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 disabled:opacity-40"
          >
            Start Drill
          </button>
          <button
            onClick={startChart}
            disabled={chartableCount === 0}
            className="w-full py-3 rounded-xl border border-primary text-primary font-semibold transition-all active:scale-95 disabled:opacity-40"
          >
            Drill Full Verb Chart
          </button>
          <p className="text-xs text-muted-foreground text-center">
            The whole table — masdar, then all thirteen persons in past and present.
            {chartableCount < selectedCount &&
              ` ${selectedCount - chartableCount} of the selected verbs can't be charted from their principal parts.`}
          </p>
        </div>

        {verbDecks.length > 0 && (
          <section className="space-y-2" aria-label="Verbs from">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Verbs from</h3>
            <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60">
              <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors">
                <input
                  type="checkbox"
                  aria-label="All decks"
                  checked={!activeDecks}
                  onChange={() => chooseDecks(null)}
                  className="w-4 h-4 accent-primary cursor-pointer"
                />
                <span className="flex-1 font-medium text-foreground">All decks</span>
                <span className="text-sm text-muted-foreground">
                  {allItems.length} verb{allItems.length === 1 ? '' : 's'}
                </span>
              </label>
              {verbDecks.map(({ deck, count }) => (
                <label
                  key={deck.id}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                >
                  <input
                    type="checkbox"
                    aria-label={`Deck ${deck.title}`}
                    checked={!!activeDecks?.some((d) => d.id === deck.id)}
                    onChange={() => toggleDeck(deck.id)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{deck.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {count} verb{count === 1 ? '' : 's'}
                  </span>
                </label>
              ))}
            </div>
            <p className="px-1 text-xs text-muted-foreground">
              Tick one or more decks to drill only their verbs; the forms and counts above follow.
            </p>
          </section>
        )}
      </div>
    );
  }

  if (index >= items.length) {
    return (
      <div className="space-y-4">
        <BackButton label="Learn" onClick={onBack} />
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
        <BackButton label="Forms" onClick={() => setPhase('select')} />
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
          // What a perfectly regular root would have in this form, so the
          // verb's own answer can be read against the pattern it departs from.
          const baseline = baselineFor(current.verbForm)?.[field.key] ?? null;
          const sameAsBaseline =
            !!baseline && normalizeArabicKeepVowels(baseline.text) === normalizeArabicKeepVowels(expected);

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
              {results && (
                <div className="rounded-xl bg-muted/40 px-3 py-2 space-y-1.5" dir="rtl">
                  <p
                    className={`flex items-center gap-1.5 font-arabic text-xl ${wrong ? 'text-success' : 'text-foreground'}`}
                  >
                    <Check className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{expected}</span>
                    {!wrong && !typedItExactly && (
                      <span className="font-sans text-xs text-muted-foreground" dir="ltr">
                        full vowelling
                      </span>
                    )}
                  </p>
                  {baseline &&
                    (sameAsBaseline ? (
                      <p className="font-sans text-xs text-muted-foreground" dir="ltr">
                        Same as the Form {current.verbForm} baseline.
                      </p>
                    ) : (
                      <p className="flex flex-wrap items-baseline gap-x-2 font-arabic text-lg text-muted-foreground">
                        <span>{baseline.text}</span>
                        <span className="font-sans text-xs" dir="ltr">
                          Form {current.verbForm} baseline{baseline.note ? ` · ${baseline.note}` : ''}
                        </span>
                        {followsBaseline(expected, current.root, baseline.text, { ignoreVowels: field.key === 'masdar' }) ? (
                          <span className="font-sans text-xs text-muted-foreground" dir="ltr">
                            ✓ follows the pattern
                          </span>
                        ) : (
                          <span className="font-sans text-xs font-semibold text-amber-600 dark:text-amber-400" dir="ltr">
                            ≠ departs from the pattern
                          </span>
                        )}
                      </p>
                    ))}
                </div>
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
