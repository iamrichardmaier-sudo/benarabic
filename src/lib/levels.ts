/**
 * Levels: how XP turns into a level, and how much each action earns.
 *
 * The level is never stored, only the XP total (public.user_progress), so the
 * curve below can be retuned without touching anyone's data. The Scriptable
 * widget (scripts/scriptable/wazn-review.js) carries a copy of LEVEL_XP and
 * XP_FOR_RATING; keep the two in step.
 */
import type { Rating } from './spaced-repetition';

export const MAX_LEVEL = 15;

/**
 * Total XP needed to reach each level: 250 × (level − 1)². Level 2 comes in
 * the first session (about 25 cards); a day of full review (~900 XP) then
 * reaches level 15 in roughly two months.
 */
export const LEVEL_XP: readonly number[] = Array.from({ length: MAX_LEVEL }, (_, i) => 250 * i * i);

/** What one graded card earns. "Easy" earns no more than "Good", so it is never worth pressing for points. */
export const XP_FOR_RATING: Record<Rating, number> = { again: 3, hard: 6, good: 10, easy: 10 };

/** Learn mode: recognising a word, and producing it. */
export const XP_LEARN = { choiceRight: 5, choiceWrong: 1, typedRight: 10, typedWrong: 2 } as const;

/** Practice changes no schedule, so it earns half. */
export function xpForGrade(rating: Rating, practice = false): number {
  const base = XP_FOR_RATING[rating];
  return practice ? Math.ceil(base / 2) : base;
}

export function levelFor(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  return level;
}

export interface LevelProgress {
  level: number;
  xp: number;
  /** XP at the start of this level and needed for the next (null at the top). */
  floor: number;
  next: number | null;
  /** 0–1 through the current level; 1 at the maximum level. */
  fraction: number;
  /** XP still to earn for the next level, 0 at the top. */
  toNext: number;
}

export function progressFor(xp: number): LevelProgress {
  const level = levelFor(xp);
  const floor = LEVEL_XP[level - 1];
  const next = level < MAX_LEVEL ? LEVEL_XP[level] : null;
  return {
    level,
    xp,
    floor,
    next,
    fraction: next === null ? 1 : (xp - floor) / (next - floor),
    toNext: next === null ? 0 : next - xp,
  };
}
