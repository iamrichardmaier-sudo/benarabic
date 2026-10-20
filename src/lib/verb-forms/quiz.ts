import { FORM_FACTS, type Conjugation } from './data';
import { classifyRoot, FORM_IDS, type FormId } from './generate';
import { conjugate, PEOPLE, type PersonId } from '@/lib/conjugation';

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
  definition: string | null;
  usageNote: string | null;
  summary: string;
  detail: string;
  clue: string;
  /** The conjugated form the question showed, when it was not the dictionary form. */
  shown?: { text: string; label: string };
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
  { level: 2, title: 'Level 2 · Real verbs', blurb: 'Everyday verbs, weak ones too, in every person and tense. Name the form.' },
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
    definition: row.definition,
    usageNote: row.usageNote,
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

type Prompt = { text: string; hint?: string; shown?: { text: string; label: string } };

/**
 * Where a weak verb's weakness shows. A hollow past shortens before a
 * consonant ending (قُلْتُ), a defective one changes its last letter (نَسِيتُ,
 * يَنْسَوْنَ), a doubled one opens up (مَرَرْنا, يَمْرُرْنَ). These are the
 * people a weak verb is asked in most of the time.
 */
const REVEALING: Record<'past' | 'present', PersonId[]> = {
  past: ['ana', 'anta', 'anti', 'nahnu', 'antum', 'antunna', 'hunna', 'hum'],
  present: ['anti', 'antum', 'hum', 'hunna', 'antunna', 'antuma'],
};

/** A Level 2 prompt: the verb in a random person and tense. */
function conjugatedPrompt(r: Conjugation, rng: Rng): Prompt | null {
  // A hamza inside the root, or two weak letters, changes the spelling in ways
  // the conjugator does not model (جِئْتُ, أَحْيَيْتُ), so those stay in the
  // dictionary form rather than risk a wrong one.
  const risky = /[ءأإآؤئ]/.test(r.root.split('-').slice(1).join('')) || classifyRoot(r.root) === 'mixed';
  const chart = risky ? null : conjugate({ root: r.root, past: r.past, present: r.present });
  if (!chart) return { text: r.present, hint: 'present tense' };
  const tense = rng() < 0.5 ? 'past' : 'present';
  const weak = chart.cls !== 'sound';
  const people = weak && rng() < 0.75 ? REVEALING[tense] : PEOPLE.map((p) => p.id);
  const id = people[Math.floor(rng() * people.length)];
  const person = PEOPLE.find((p) => p.id === id)!;
  const text = chart[tense][id];
  if (!text) return { text: r.present, hint: 'present tense' };
  const label = `${person.english}, ${tense}`;
  return { text, hint: `${person.pronoun} · ${tense} tense`, shown: { text, label } };
}

const promptFor = (level: Level, r: Conjugation, rng: Rng = Math.random): Prompt | null => {
  if (level === 1) return { text: r.past, hint: 'past tense' };
  if (level === 2) return conjugatedPrompt(r, rng);
  return r.masdar ? { text: r.masdar, hint: 'verbal noun' } : null;
};

/**
 * How likely each form is to be asked. Form I has no added letters and Form IX
 * is almost only colours, so both turn up, but far less often than the forms
 * whose patterns are the point of the drill.
 */
export const FORM_WEIGHT: Record<FormId, number> = {
  I: 0.2, II: 1, III: 1, IV: 1, V: 1, VI: 1, VII: 1, VIII: 1, IX: 0.2, X: 1,
};

export interface IdentifySet {
  questions: Question[];
  /** True when there were not enough distinct verbs for the full count. */
  short: boolean;
}

/**
 * The identify quiz. Forms are drawn at random by FORM_WEIGHT, no verb appears
 * twice, and a form that runs out of verbs simply stops being drawn.
 */
export function buildIdentify(
  rows: Conjugation[],
  level: Level,
  rng: Rng = Math.random,
  count = 30,
  rootMeanings: Record<string, string> = {},
): IdentifySet {
  const prompts = new Map<Conjugation, Prompt>();
  for (const r of eligibleFor(level, rows)) {
    const p = promptFor(level, r, rng);
    if (p) prompts.set(r, p);
  }
  const pool = [...prompts.keys()];
  const byForm = new Map<FormId, Conjugation[]>();
  for (const f of FORM_IDS) {
    const seen = new Set<string>();
    const unique = shuffle(pool.filter((r) => r.form === f), rng).filter((r) => {
      const p = prompts.get(r)!.text;
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
  // Each question draws its form at random, weighted so the rare forms stay rare.
  while (remaining > 0) {
    const open = forms.filter((f) => take.get(f)! < byForm.get(f)!.length);
    if (open.length === 0) break;
    const sum = open.reduce((n, f) => n + FORM_WEIGHT[f], 0);
    let roll = rng() * sum;
    const f = open.find((g) => (roll -= FORM_WEIGHT[g]) < 0) ?? open[open.length - 1];
    take.set(f, take.get(f)! + 1);
    remaining--;
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
    const p = prompts.get(r)!;
    return {
      id: `${level}-${i}-${r.id}`,
      kind: 'identify',
      prompt: p.text,
      hint: p.hint,
      arabic: true,
      options,
      answer: r.form,
      explanation: { ...explain(r, rootMeanings[r.root] ?? null), shown: p.shown },
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
const firstSense = (s: string) => norm(s.split(';')[0].replace(/^to /, ''));
/** Two glosses that open on the same sense would make a question unfair. */
const overlaps = (a: string, b: string) => {
  const x = firstSense(a);
  const y = firstSense(b);
  const within = (long: string, short: string) => ` ${long} `.includes(` ${short} `);
  return x === y || within(x, y) || within(y, x);
};

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
      if (m && !overlaps(m, r.meaning!) && !wrong.some((w) => norm(w) === norm(m)) && wrong.length < 3) wrong.push(m);
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
