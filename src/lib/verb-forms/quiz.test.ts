import { describe, expect, it } from 'vitest';
import { buildIdentify, buildMeanings, shuffle } from './quiz';
import type { Conjugation } from './data';
import { FORM_IDS, type FormId } from './generate';
import { rootKey } from '@/lib/word-relations';

let n = 0;
const row = (root: string, form: FormId, over: Partial<Conjugation> = {}): Conjugation => ({
  id: `r${n++}`,
  root,
  form,
  past: `${form}-${root}-past`,
  present: `${form}-${root}-pres`,
  masdar: `${form}-${root}-masdar`,
  meaning: `sense ${n}`,
  definition: null,
  usageNote: null,
  tier: 3,
  confidence: 'high',
  weak: 'sound',
  source: 'test',
  reviewed: false,
  ...over,
});

const ROOTS = ['ك-ت-ب', 'د-ر-س', 'ف-ت-ح', 'ع-ل-م'];
const full = () => FORM_IDS.flatMap((f) => ROOTS.map((r) => row(r, f)));

describe('buildIdentify', () => {
  it('Level 1 is 30 questions with no repeats', () => {
    const { questions, short } = buildIdentify(full(), 1);
    expect(short).toBe(false);
    expect(questions).toHaveLength(30);
    expect(new Set(questions.map((q) => q.prompt)).size).toBe(30);
  });

  it('asks Forms I and IX far less often than the others, but still asks them', () => {
    const many = Array.from({ length: 6 }, (_, r) => FORM_IDS.flatMap((f) => Array.from({ length: 8 }, (_, i) => row(`r${r}-${i}`, f))));
    const counts: Record<string, number> = {};
    for (let run = 0; run < 200; run++) {
      for (const q of buildIdentify(many.flat(), 1).questions) counts[q.answer] = (counts[q.answer] ?? 0) + 1;
    }
    const others = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'X'].map((f) => counts[f]);
    const avgOther = others.reduce((a, b) => a + b, 0) / others.length;
    expect(counts.I).toBeGreaterThan(0);
    expect(counts.IX).toBeGreaterThan(0);
    expect(counts.I).toBeLessThan(avgOther * 0.4);
    expect(counts.IX).toBeLessThan(avgOther * 0.4);
  });

  it('Levels 2 and 3 never use a guessed row, and Level 2 never asks Form IX', () => {
    const rows = [...full(), ...FORM_IDS.map((f) => row('ش-ك-ر', f, { confidence: 'medium', past: `GUESS-${f}`, present: `GUESS-${f}`, masdar: `GUESS-${f}` }))];
    for (const level of [2, 3] as const) {
      const { questions } = buildIdentify(rows, level);
      expect(questions.some((q) => q.prompt.startsWith('GUESS'))).toBe(false);
    }
    const l2 = buildIdentify(rows, 2).questions;
    expect(l2.some((q) => q.answer === 'IX')).toBe(false);
    expect(l2[0].options.map((o) => o.id)).not.toContain('IX');
  });

  it('Level 1 skips weak verbs', () => {
    const rows = [...full(), row('ق-و-ل', 'IV', { weak: 'hollow', past: 'WEAK' })];
    expect(buildIdentify(rows, 1).questions.some((q) => q.prompt === 'WEAK')).toBe(false);
  });

  it('falls back to a shorter set when the deck is small', () => {
    const rows = [row('ك-ت-ب', 'I'), row('ك-ت-ب', 'II'), row('د-ر-س', 'II')];
    const { questions, short } = buildIdentify(rows, 1);
    expect(short).toBe(true);
    expect(questions).toHaveLength(3);
    expect(buildIdentify([], 1)).toEqual({ questions: [], short: true });
  });

  it('puts the explanation on every question', () => {
    const q = buildIdentify(full(), 1).questions[0];
    expect(q.explanation.clue).toBeTruthy();
    expect(q.explanation.pattern).toBeTruthy();
  });
});

describe('Level 2 conjugations', () => {
  it('shows real verbs in other persons and tenses, and says which', () => {
    const rows = [
      row('ق-و-ل', 'I', { past: 'قالَ', present: 'يَقول', weak: 'hollow' }),
      row('ن-س-ي', 'I', { past: 'نَسِيَ', present: 'يَنسى', weak: 'defective' }),
      row('ك-ت-ب', 'II', { past: 'كَتَّبَ', present: 'يُكَتِّب' }),
    ];
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      for (const q of buildIdentify(rows, 2).questions) {
        seen.add(q.prompt);
        expect(q.explanation.shown?.text ?? q.prompt).toBe(q.prompt);
      }
    }
    expect([...seen].some((p) => !['قالَ', 'يَقول', 'نَسِيَ', 'يَنسى'].includes(p))).toBe(true);
  });

  it('keeps hamza-medial and doubly weak roots in their dictionary form', () => {
    const rows = [row('ج-ي-أ', 'I', { past: 'جاءَ', present: 'يَجيء', weak: 'mixed' })];
    expect(buildIdentify(rows, 2).questions[0].prompt).toBe('يَجيء');
  });
});

describe('buildMeanings', () => {
  const opts = { keyOf: rootKey, count: 8 };

  it('offers the right answer among four distinct options', () => {
    const qs = buildMeanings(full(), opts);
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.label.toLowerCase())).size).toBe(4);
      expect(q.options.find((o) => o.id === q.answer)).toBeTruthy();
    }
  });

  it('only asks about roots with two different meanings, and only trusted rows', () => {
    const rows = [row('ك-ت-ب', 'I'), row('د-ر-س', 'I'), row('د-ر-س', 'II', { confidence: 'low' })];
    expect(buildMeanings(rows, opts)).toEqual([]);
  });

  it('can be limited to chosen roots and hide the verb', () => {
    const qs = buildMeanings(full(), { ...opts, roots: new Set([rootKey('ك-ت-ب')]), hideVerb: true });
    expect(qs.length).toBeGreaterThan(0);
    expect(qs.every((q) => q.prompt === 'ك-ت-ب')).toBe(true);
  });
});

describe('shuffle', () => {
  it('keeps every item', () => {
    expect(shuffle([1, 2, 3, 4]).sort()).toEqual([1, 2, 3, 4]);
  });
});
