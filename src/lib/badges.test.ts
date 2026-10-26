import { describe, it, expect, beforeEach } from 'vitest';
import { BADGES, checkBadges, completeRootFamilies, learnedForms, earnedBadges } from './badges';
import type { FlashCard } from './spaced-repetition';

const card = (over: Partial<FlashCard>): FlashCard => ({ id: Math.random().toString(36), word: 'x', learningStage: 'graduated', ...over } as FlashCard);

describe('badges', () => {
  beforeEach(() => localStorage.clear());

  it('finds root families only when every word of the root is learned', () => {
    const deck = [card({ root: 'ك ت ب' }), card({ root: 'ك ت ب' }), card({ root: 'ك ت ب' }), card({ root: 'ع ل م' }), card({ root: 'ع ل م' }), card({ root: 'ع ل م', learningStage: 'new' })];
    expect(completeRootFamilies(deck)).toEqual(['ك ت ب']);
  });

  it('counts verb forms from learned verbs only', () => {
    const deck = [card({ wordType: 'verb', verbForm: 'I' }), card({ wordType: 'masdar', verbForm: 'IV' }), card({ wordType: 'verb', verbForm: 'X', learningStage: 'new' })];
    expect(learnedForms(deck)).toEqual(['I']);
  });

  it('records quietly on the first check, then announces new ones', () => {
    const ctx = { cards: Array.from({ length: 12 }, () => card({})), longestStreak: 0, chaptersRead: 0, level: 1 };
    expect(checkBadges(ctx)).toEqual([]);
    expect(Object.keys(earnedBadges())).toEqual(['words-10']);
    const fresh = checkBadges({ ...ctx, longestStreak: 7 });
    expect(fresh.map((b) => b.id)).toEqual(['streak-7']);
    expect(checkBadges({ ...ctx, longestStreak: 7 })).toEqual([]);
  });

  it('has unique ids', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
  });
});
