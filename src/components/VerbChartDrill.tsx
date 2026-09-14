import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { ChevronLeft, Check } from 'lucide-react';
import { normalizeArabicKeepVowels, normalizeArabicIgnoreShortVowels } from '@/lib/arabic-normalize';
import { VERB_FORM_GLOSSES } from '@/lib/morphology';
import GlossPopover from '@/components/GlossPopover';
import { type PersonId } from '@/lib/conjugation';
import { chartable, CHART_PEOPLE, type ChartVerb } from '@/lib/verb-chart';

interface VerbChartDrillProps {
  verbs: ChartVerb[];
  rootMeanings: Record<string, string>;
  ignoreShortVowels: boolean;
  onBack: () => void;
}

/** Every blank in the chart, in the order the eye and the Tab key move. */
type CellKey = string;

const cellKey = (tense: 'past' | 'present', person: PersonId): CellKey => `${tense}:${person}`;
const MASDAR: CellKey = 'masdar';

const CLASS_LABEL: Record<string, string> = {
  sound: 'Sound',
  hollow: 'Hollow',
  defective: 'Defective',
  doubled: 'Doubled',
};

const GROUP_LABEL: Record<string, string> = {
  singular: 'Singular',
  plural: 'Plural',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const VerbChartDrill = ({ verbs, rootMeanings, ignoreShortVowels, onBack }: VerbChartDrillProps) => {
  const pool = useMemo(() => shuffle(chartable(verbs)), [verbs]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<CellKey, string>>({});
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const advanceRef = useRef<() => void>(() => {});

  const entry = pool[index];

  // The blanks in tab order: masdar first, then each person's past and present.
  const order = useMemo<CellKey[]>(() => {
    const keys: CellKey[] = [MASDAR];
    for (const person of CHART_PEOPLE) {
      keys.push(cellKey('past', person.id));
      keys.push(cellKey('present', person.id));
    }
    return keys;
  }, []);

  const expected = useMemo<Record<CellKey, string>>(() => {
    if (!entry) return {};
    const map: Record<CellKey, string> = { [MASDAR]: entry.verb.masdarForm };
    for (const person of CHART_PEOPLE) {
      map[cellKey('past', person.id)] = entry.chart.past[person.id];
      map[cellKey('present', person.id)] = entry.chart.present[person.id];
    }
    return map;
  }, [entry]);

  const normalize = ignoreShortVowels ? normalizeArabicIgnoreShortVowels : normalizeArabicKeepVowels;

  const results = useMemo<Record<CellKey, boolean> | null>(() => {
    if (!checked) return null;
    const out: Record<CellKey, boolean> = {};
    for (const key of order) out[key] = normalize(answers[key] ?? '') === normalize(expected[key] ?? '');
    return out;
  }, [checked, answers, expected, order, normalize]);

  const rightCount = results ? order.filter((k) => results[k]).length : 0;

  useEffect(() => {
    setAnswers({});
    setChecked(false);
    // Focus the masdar blank so a chart can be typed start to finish without
    // ever reaching for the mouse.
    containerRef.current?.querySelector<HTMLInputElement>('input:not([disabled])')?.focus();
  }, [index]);

  const check = () => {
    if (checked || !entry) return;
    let right = 0;
    for (const key of order) {
      if (normalize(answers[key] ?? '') === normalize(expected[key] ?? '')) right++;
    }
    setScore((s) => ({ correct: s.correct + right, total: s.total + order.length }));
    setChecked(true);
  };

  const advance = () => setIndex((i) => i + 1);
  advanceRef.current = advance;

  // Declared above the early returns so the hook count never changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || e.repeat) return;
      if (!checked) return;
      const target = e.target;
      if (target instanceof Element && target.closest('button,a,input')) return;
      e.preventDefault();
      advanceRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [checked]);

  const focusCell = (key: CellKey) => {
    containerRef.current
      ?.querySelector<HTMLInputElement>(`input[data-cell="${CSS.escape(key)}"]`)
      ?.focus();
  };

  const onCellKeyDown = (e: React.KeyboardEvent, key: CellKey) => {
    if (e.key !== 'Enter' || e.repeat) return;
    e.preventDefault();
    // Stopped here as well as defaulted: checking flips `checked`, React
    // flushes that before this native event has finished travelling up to the
    // window listener, which would otherwise catch the very press that caused
    // the check and skip straight past the answers.
    e.stopPropagation();
    if (checked) {
      advance();
      return;
    }
    const at = order.indexOf(key);
    // Enter walks to the next blank still empty; once none are left it checks,
    // so a chart can be filled in any order and submitted from anywhere.
    const nextEmpty = order.slice(at + 1).find((k) => !(answers[k] ?? '').trim())
      ?? order.find((k) => !(answers[k] ?? '').trim());
    if (nextEmpty && nextEmpty !== key) focusCell(nextEmpty);
    else check();
  };

  if (pool.length === 0) {
    return (
      <div className="space-y-4">
        <BackLink label="Forms" onClick={onBack} />
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <p className="text-foreground font-medium">No chartable verbs in this selection.</p>
          <p className="text-sm text-muted-foreground">
            A full chart is only built from a triliteral root whose past and present are both
            recorded. Pick some more forms, or drill the principal parts instead.
          </p>
        </div>
      </div>
    );
  }

  if (index >= pool.length) {
    const pct = score.total ? Math.round((score.correct / score.total) * 100) : 0;
    return (
      <div className="space-y-4">
        <BackLink label="Forms" onClick={onBack} />
        <div className="rounded-2xl border border-border bg-card p-8 text-center space-y-2">
          <p className="text-foreground font-medium">Charts complete!</p>
          <p className="text-sm text-muted-foreground">
            {score.correct} / {score.total} cells correct ({pct}%)
          </p>
        </div>
        <button
          onClick={onBack}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
        >
          Choose forms
        </button>
      </div>
    );
  }

  const { verb, chart } = entry;
  const formGloss = VERB_FORM_GLOSSES[verb.verbForm];

  return (
    <div className="space-y-4" ref={containerRef}>
      <div className="flex items-center justify-between">
        <BackLink label="Forms" onClick={onBack} />
        <span className="text-sm text-muted-foreground">
          {index + 1} / {pool.length}
        </span>
      </div>

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Full Verb Chart</h2>
        {ignoreShortVowels && (
          <p className="text-xs text-muted-foreground">Short vowels aren't being checked.</p>
        )}
      </div>

      {/* The prompt: the root, its meaning, the form, and the masdar blank. */}
      <div className="rounded-2xl bg-card flashcard-shadow border border-border/50 p-5 space-y-3">
        <div className="flex flex-col items-center gap-1">
          <GlossPopover
            title={verb.root}
            subtitle="Root"
            body={
              rootMeanings[verb.root] ??
              'No gloss recorded for this root yet — the sense has to be inferred from the words that use it.'
            }
            side="top"
            triggerLabel={`What the root ${verb.root} means`}
            className="px-2 py-1 underline"
          >
            <span className="text-[36px] font-bold text-foreground font-arabic" dir="rtl">
              {verb.root}
            </span>
          </GlossPopover>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {formGloss ? (
              <GlossPopover
                title={formGloss.pattern}
                subtitle={`Form ${verb.verbForm} — ${formGloss.summary}`}
                body={formGloss.detail}
                side="bottom"
                triggerLabel={`What Form ${verb.verbForm} does to a root`}
                className="px-2 py-0.5 underline"
              >
                Form {verb.verbForm}
              </GlossPopover>
            ) : (
              <span>Form {verb.verbForm}</span>
            )}
            <span aria-hidden="true">·</span>
            <span>{CLASS_LABEL[chart.cls] ?? chart.cls}</span>
          </div>
        </div>

        <Cell
          label="Masdar"
          cellKey={MASDAR}
          value={answers[MASDAR] ?? ''}
          expected={expected[MASDAR]}
          correct={results?.[MASDAR]}
          checked={checked}
          onChange={(v) => setAnswers((a) => ({ ...a, [MASDAR]: v }))}
          onKeyDown={onCellKeyDown}
          big
        />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="text-start px-2 py-2 font-medium w-[26%]">
                Person
              </th>
              <th scope="col" className="text-start px-1 py-2 font-medium">
                Past
              </th>
              <th scope="col" className="text-start px-1 py-2 font-medium">
                Present
              </th>
            </tr>
          </thead>
          <tbody>
            {CHART_PEOPLE.map((person, i) => {
              const startsGroup = i === 0 || CHART_PEOPLE[i - 1].number !== person.number;
              return (
                <Fragment key={person.id}>
                  {startsGroup && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground/70 border-t border-border"
                      >
                        {GROUP_LABEL[person.number]}
                      </td>
                    </tr>
                  )}
                  <tr className="align-top">
                    <th scope="row" className="px-2 py-1.5 font-normal text-start">
                      <span className="block font-arabic text-base text-foreground text-start">
                        {person.pronoun}
                      </span>
                      <span className="block text-[11px] leading-tight text-muted-foreground">
                        {person.english}
                      </span>
                    </th>
                    {(['past', 'present'] as const).map((tense) => {
                      const key = cellKey(tense, person.id);
                      return (
                        <td key={tense} className="px-1 py-1.5">
                          <Cell
                            label={`${person.english} ${tense}`}
                            hideLabel
                            cellKey={key}
                            value={answers[key] ?? ''}
                            expected={expected[key]}
                            correct={results?.[key]}
                            checked={checked}
                            onChange={(v) => setAnswers((a) => ({ ...a, [key]: v }))}
                            onKeyDown={onCellKeyDown}
                          />
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!checked ? (
        <button
          onClick={check}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
        >
          Check Chart
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-center text-sm text-muted-foreground">
            {rightCount} / {order.length} correct on this chart
          </p>
          <button
            onClick={advance}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" /> Continue
          </button>
        </div>
      )}
    </div>
  );
};

const BackLink = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
  >
    <ChevronLeft className="w-4 h-4" />
    {label}
  </button>
);

interface CellProps {
  label: string;
  hideLabel?: boolean;
  cellKey: CellKey;
  value: string;
  expected: string;
  correct?: boolean;
  checked: boolean;
  big?: boolean;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent, key: CellKey) => void;
}

const Cell = ({
  label,
  hideLabel,
  cellKey: key,
  value,
  expected,
  correct,
  checked,
  big,
  onChange,
  onKeyDown,
}: CellProps) => {
  // Shown whenever the typed answer isn't character-for-character the stored
  // one, so a lenient pass still gets to see the full vowelling.
  const exact = normalizeArabicKeepVowels(value) === normalizeArabicKeepVowels(expected);
  const border = !checked ? 'border-border' : correct ? 'border-success' : 'border-destructive';

  return (
    <div className="space-y-0.5">
      {!hideLabel && <label className="text-sm text-muted-foreground font-medium block">{label}</label>}
      <input
        type="text"
        data-cell={key}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => onKeyDown(e, key)}
        disabled={checked}
        dir="rtl"
        className={`w-full font-arabic bg-card border rounded-lg px-2 py-1.5 text-foreground focus:ring-2 focus:ring-primary/30 focus:outline-none disabled:opacity-80 ${border} ${big ? 'text-2xl px-4 py-2.5 rounded-xl' : 'text-lg'}`}
      />
      {checked && !exact && (
        <p
          className={`text-sm font-arabic leading-snug ${correct ? 'text-muted-foreground' : 'text-success'}`}
          dir="rtl"
        >
          {expected}
        </p>
      )}
    </div>
  );
};

export default VerbChartDrill;
