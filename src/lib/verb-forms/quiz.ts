import { FORM_FACTS, type Conjugation } from './data';
import { FORM_IDS, type FormId } from './generate';

export type Rng = () => number;

export interface Option {
  id: string;
  label: string;
}

/** What the card shows after an answer: why the form is what it is. */
export interface Explanation {
  root: string;
  rootMeaning: string | null;
  form: FormId;
  pattern: string;
  past: string;
  present: string;
  masdar: string | null;
  meaning: string | null;
  summary: string;
  detail: string;
  clue: string;
}

export interface Question {
  id: string;
  kind: 'identify' | 'meaning';
  prompt: string;
  /** Small line under the prompt. */
  hint?: string;
  /** Whether the prompt is Arabic (set right-to-left, large). */
  arabic: boolean;
  options: Option[];
  answer: string;
  explanation: Explanation;
}

export type Level = 1 | 2 | 3;

export const LEVELS: { level: Level; title: string; blurb: string }[] = [
  { level: 1, title: 'Level 1 · Patterns', blurb: 'Regular roots and every form. Read the past tense, name the form.' },
  { level: 2, title: 'Level 2 · Real verbs', blurb: 'Everyday verbs, weak ones too. Read the present tense, name the form.' },
  { level: 3, title: 'Level 3 · Verbal nouns', blurb: 'Name the form from the verbal noun alone, colour verbs included.' },
];

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function explain(row: Conjugation, rootMeaning: string | null = null): Explanation {
  const fact = FORM_FACTS[row.form];
  return {
    root: row.root,
    rootMeaning,
    form: row.form,
    pattern: fact.pattern,
    past: row.past,
    present: row.present,
    masdar: row.masdar,
    meaning: row.meaning,
    summary: fact.summary,
    detail: fact.detail,
    clue: fact.clue,
  };
}

/** Only rows a quiz may rely on: reviewed or machine-verified, never a guess. */
export const quizzable = (rows: Conjugation[]) => rows.filter((r) => r.confidence === 'high');

function eligibleFor(level: Level, rows: Conjugation[]): Conjugation[] {
  const high = quizzable(rows);
  if (level === 1) return high.filter((r) => r.weak === 'sound' || r.form === 'IX');
  if (level === 2) return high.filter((r) => r.form !== 'IX');
  return high;
}

const promptFor = (level: Level, r: Conjugation): { text: string; hint?: string } | null => {
  if (level === 1) return { text: r.past, hint: 'past tense' };
  if (level === 2) return { text: r.present, hint: 'present tense' };
  return r.masdar ? { text: r.masdar, hint: 'verbal noun' } : null;
};

export interface IdentifySet {
  questions: Question[];
  /** True when there were not enough distinct verbs for the full count. */
  short: boolean;
}

/**
 * The identify quiz. Every form that has verbs is asked about evenly (and at
 * least twice at Level 1), no verb appears twice, and a form with too few
 * verbs hands its unused questions to the forms that have more.
 */
export function buildIdentify(
  rows: Conjugation[],
  level: Level,
  rng: Rng = Math.random,
  count = 30,
  rootMeanings: Record<string, string> = {},
): IdentifySet {
  const pool = eligibleFor(level, rows).filter((r) => promptFor(level, r));
  const byForm = new Map<FormId, Conjugation[]>();
  for (const f of FORM_IDS) {
    const seen = new Set<string>();
    const unique = shuffle(pool.filter((r) => r.form === f), rng).filter((r) => {
      const p = promptFor(level, r)!.text;
      if (seen.has(p)) return false;
      seen.add(p);
      return true;
    });
    if (unique.length > 0) byForm.set(f, unique);
  }

  const forms = [...byForm.keys()];
  if (forms.length === 0) return { questions: [], short: true };

  const take = new Map<FormId, number>(forms.map((f) => [f, 0]));
  let remaining = Math.min(count, [...byForm.values()].reduce((n, l) => n + l.length, 0));
  const total = remaining;
  // Deal one question at a time to each form with verbs left, in a random order.
  while (remaining > 0) {
    let dealt = false;
    for (const f of shuffle(forms, rng)) {
      if (remaining === 0) break;
      if (take.get(f)! < byForm.get(f)!.length) {
        take.set(f, take.get(f)! + 1);
        remaining--;
        dealt = true;
      }
    }
    if (!dealt) break;
  }

  const offered = FORM_IDS.filter((f) => (level === 2 ? f !== 'IX' : true));
  const options: Option[] = offered.map((f) => ({ id: f, label: f }));

  let picked: Conjugation[] = forms.flatMap((f) => byForm.get(f)!.slice(0, take.get(f)));
  picked = shuffle(picked, rng);
  // Keep two verbs of the same root from sitting side by side.
  for (let i = 1; i < picked.length; i++) {
    if (picked[i].root === picked[i - 1].root) {
      const j = picked.findIndex((r, k) => k > i && r.root !== picked[i - 1].root);
      if (j > -1) [picked[i], picked[j]] = [picked[j], picked[i]];
    }
  }

  const questions = picked.map((r, i): Question => {
    const p = promptFor(level, r)!;
    return {
      id: `${level}-${i}-${r.id}`,
      kind: 'identify',
      prompt: p.text,
      hint: p.hint,
      arabic: true,
      options,
      answer: r.form,
      explanation: explain(r, rootMeanings[r.root] ?? null),
    };
  });
  return { questions, short: total < count };
}

export interface MeaningOptions {
  count?: number;
  /** Ask about these roots only (by hamza-folded key). */
  roots?: Set<string>;
  /** Show the root and form instead of the verb. */
  hideVerb?: boolean;
  keyOf: (root: string) => string;
  rootMeanings?: Record<string, string>;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * "What does this form mean?" The wrong answers are the other forms of the
 * same root first, because the point is telling one form's meaning from its
 * siblings'; other roots fill any gap.
 */
export function buildMeanings(rows: Conjugation[], opts: MeaningOptions, rng: Rng = Math.random): Question[] {
  const count = opts.count ?? 10;
  const pool = quizzable(rows).filter((r) => r.meaning);
  const byRoot = new Map<string, Conjugation[]>();
  for (const r of pool) {
    const k = opts.keyOf(r.root);
    if (opts.roots && !opts.roots.has(k)) continue;
    byRoot.set(k, [...(byRoot.get(k) ?? []), r]);
  }
  const usable = [...byRoot.entries()].filter(([, l]) => new Set(l.map((r) => norm(r.meaning!))).size >= 2);

  const chosen: Conjugation[] = [];
  const roots = shuffle(usable, rng);
  for (let round = 0; chosen.length < count && round < 3; round++) {
    for (const [, list] of roots) {
      if (chosen.length >= count) break;
      const next = shuffle(list, rng).find((r) => !chosen.includes(r));
      if (next) chosen.push(next);
    }
  }

  return chosen.map((r, i): Question => {
    const siblings = (byRoot.get(opts.keyOf(r.root)) ?? []).filter((s) => s !== r);
    const wrong: string[] = [];
    const add = (m: string | null) => {
      if (m && norm(m) !== norm(r.meaning!) && !wrong.some((w) => norm(w) === norm(m)) && wrong.length < 3) wrong.push(m);
    };
    shuffle(siblings, rng).forEach((s) => add(s.meaning));
    shuffle(pool.filter((p) => p.form !== r.form), rng).forEach((p) => add(p.meaning));
    const fact = FORM_FACTS[r.form];
    const options = shuffle(
      [{ id: 'right', label: r.meaning! }, ...wrong.map((w, k) => ({ id: `w${k}`, label: w }))],
      rng,
    );
    return {
      id: `m-${i}-${r.id}`,
      kind: 'meaning',
      prompt: opts.hideVerb ? r.root : r.past,
      hint: opts.hideVerb ? `Form ${r.form} · ${fact.pattern}` : `Root ${r.root} · Form ${r.form}`,
      arabic: true,
      options,
      answer: 'right',
      explanation: explain(r, opts.rootMeanings?.[r.root] ?? null),
    };
  });
}

export interface HeatCell {
  form: FormId;
  tier: number;
  row: Conjugation | null;
}

/** All ten forms of a root, tier 0 where the language has no such verb. */
export function heatCells(rows: Conjugation[]): HeatCell[] {
  return FORM_IDS.map((form) => {
    const row = rows.find((r) => r.form === form) ?? null;
    return { form, tier: row ? row.tier : 0, row };
  });
}

export const TIER_LABELS = ['Not used', 'Rare', 'Occasional', 'Common', 'Very common'];
