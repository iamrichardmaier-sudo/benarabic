import { describe, it, expect } from 'vitest';
import { RANGES, bareSingular, drillableNouns, pickNumber } from './numbers-drill';
import type { FlashCard } from './spaced-repetition';

const card = (o: Partial<FlashCard>): FlashCard => ({
  id: o.word ?? 'x', word: '', english: null, imageUrl: null,
  nextReviewDate: '2026-01-01', intervalDays: 1, easeFactor: 2.5,
  learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0,
  wordType: 'noun', ...o,
}) as FlashCard;

describe('bareSingular', () => {
  it('drops the definite article, since a counted noun is indefinite', () => {
    expect(bareSingular('الحاسوب')).toBe('حاسوب');
  });

  it('does not strand the assimilated lām’s shadda', () => {
    // اللَّحم without care becomes لَّحم, which is not a word.
    expect(bareSingular('اللَّحم')).toBe('لَحم');
    expect(bareSingular('الدّين')).toBe('دين');
  });

  it('leaves a word that merely starts with those letters alone', () => {
    expect(bareSingular('كِتاب')).toBe('كِتاب');
  });
});

describe('drillableNouns', () => {
  it('takes a noun that has both a gender and a plural', () => {
    const pool = drillableNouns([
      card({ word: 'كتاب', wordVoweled: 'كِتاب', fushaPlural: 'كُتُب', gender: 'm', english: 'book' }),
    ]);
    expect(pool).toHaveLength(1);
    expect(pool[0]).toMatchObject({ singular: 'كِتاب', plural: 'كُتُب', gender: 'm' });
  });

  it('leaves out a noun with no plural, which has no question to ask', () => {
    expect(drillableNouns([card({ word: 'صَبر', gender: 'm' })])).toEqual([]);
  });

  it('leaves out a noun whose gender is unknown', () => {
    expect(drillableNouns([card({ word: 'شيء', fushaPlural: 'أشياء' })])).toEqual([]);
  });

  it('leaves out anything that is not a noun', () => {
    expect(drillableNouns([
      card({ word: 'كتب', wordType: 'verb', fushaPlural: 'x', gender: 'm' }),
    ])).toEqual([]);
  });

  it('leaves out an iḍāfa, which counts by rules this drill does not teach', () => {
    expect(drillableNouns([
      card({ word: 'اِبن عَمّ', fushaPlural: 'أَبناء عَمّ', gender: 'm' }),
    ])).toEqual([]);
  });

  it('collapses duplicates so one word cannot come up three times running', () => {
    const dupe = { word: 'سوق', wordVoweled: 'سوق', fushaPlural: 'أَسواق', gender: 'f' as const };
    expect(drillableNouns([card(dupe), card({ ...dupe, id: 'other' })])).toHaveLength(1);
  });

  it('strips the article so the pooled word is the countable one', () => {
    const pool = drillableNouns([
      card({ word: 'الأَرض', wordVoweled: 'الأَرض', fushaPlural: 'أَراضي', gender: 'f' }),
    ]);
    expect(pool[0].singular).toBe('أَرض');
  });
});

describe('pickNumber', () => {
  it('stays inside the chosen range', () => {
    const few = RANGES.filter((r) => r.id === 'few');
    for (let i = 0; i < 50; i++) {
      const n = pickNumber(few);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(10);
    }
  });

  it('draws only round thousands in the top band', () => {
    // 101,000 has several idiomatic readings; multiples of a thousand have one.
    const large = RANGES.filter((r) => r.id === 'large');
    for (let i = 0; i < 50; i++) {
      expect(pickNumber(large) % 1000).toBe(0);
    }
  });

  it('reaches both ends of a range', () => {
    const unit = RANGES.filter((r) => r.id === 'unit');
    const seen = new Set(Array.from({ length: 60 }, () => pickNumber(unit)));
    expect(seen).toEqual(new Set([1, 2]));
  });

  it('can draw from several chosen ranges at once', () => {
    const two = RANGES.filter((r) => r.id === 'unit' || r.id === 'hundreds');
    const seen = new Set(Array.from({ length: 200 }, () => pickNumber(two) >= 100));
    expect(seen).toEqual(new Set([true, false]));
  });
});
