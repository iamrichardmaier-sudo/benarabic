/**
 * Daily study streak.
 *
 * Deliberately local-only (localStorage, per user id): a streak is a motivation
 * device, not data worth a network round-trip or a schema migration. It is also
 * read on every Home render, so it must never block on a request.
 *
 * "Today" is the device's local calendar day. Using UTC would break the streak
 * for anyone studying late at night west of Greenwich.
 */

const KEY_PREFIX = 'wazn-streak';

export interface StreakState {
  /** Consecutive days including today, if today has been studied. */
  current: number;
  longest: number;
  /** ISO yyyy-mm-dd of the most recent studied day, or null. */
  lastStudied: string | null;
}

const EMPTY: StreakState = { current: 0, longest: 0, lastStudied: null };

function keyFor(userId: string | undefined): string {
  return `${KEY_PREFIX}:${userId ?? 'anon'}`;
}

/** Local calendar day as yyyy-mm-dd (not UTC — see module comment). */
export function today(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  const ms = Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad);
  return Math.round(ms / 86_400_000);
}

export function readStreak(userId?: string): StreakState {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as StreakState;
    if (typeof parsed?.current !== 'number') return EMPTY;
    return parsed;
  } catch {
    return EMPTY;
  }
}

/**
 * The streak as it should be *displayed* — a stored streak whose last studied
 * day is older than yesterday has already lapsed, even though nothing has
 * written to storage since. Without this, a user returning after a week would
 * briefly see their old streak before doing anything.
 */
export function currentStreak(userId?: string, now: Date = new Date()): StreakState {
  const state = readStreak(userId);
  if (!state.lastStudied) return state;
  const gap = daysBetween(state.lastStudied, today(now));
  if (gap > 1) return { ...state, current: 0 };
  return state;
}

/** Call when the user completes any genuine study action. Idempotent per day. */
export function recordStudyDay(userId?: string, now: Date = new Date()): StreakState {
  const state = readStreak(userId);
  const day = today(now);
  if (state.lastStudied === day) return state; // already counted today

  const gap = state.lastStudied ? daysBetween(state.lastStudied, day) : null;
  // Consecutive day continues the run; any longer gap starts a new one.
  const current = gap === 1 ? state.current + 1 : 1;
  const next: StreakState = {
    current,
    longest: Math.max(current, state.longest),
    lastStudied: day,
  };
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(next));
  } catch {
    /* streak just won't persist */
  }
  return next;
}

export function studiedToday(userId?: string, now: Date = new Date()): boolean {
  return readStreak(userId).lastStudied === today(now);
}

// ------------------------------------------------------------------ freezes

/** One streak freeze is earned for every this much XP, and at most MAX_FREEZES are held. */
export const FREEZE_XP = 2000;
export const MAX_FREEZES = 2;

export interface DayStreak {
  current: number;
  longest: number;
  /** Freezes held now, after any that a missed day has used. */
  freezes: number;
  /** Days a freeze covered, most recent last (only the last two weeks). */
  frozen: string[];
  studiedToday: boolean;
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return today(new Date(y, m - 1, d + n));
}

/**
 * The streak worked out from every day XP was earned (any device, and the
 * widget), plus the days the older device-only streak already counted.
 *
 * Walking the days in order: each day studied extends the run, and every
 * FREEZE_XP earned banks a freeze (up to MAX_FREEZES). A gap of missed days is
 * bridged if there are enough freezes to cover all of it, which uses them up;
 * otherwise the run starts again. It is a pure function of the days, so every
 * screen and every device agrees without storing what was used.
 */
export function streakFromDays(days: Readonly<Record<string, number>>, legacy: StreakState = EMPTY, now: Date = new Date()): DayStreak {
  const set = new Set(Object.keys(days).filter((d) => days[d] > 0));
  if (legacy.lastStudied && legacy.current > 0) {
    for (let i = 0; i < legacy.current; i++) set.add(addDays(legacy.lastStudied, -i));
  }
  const list = [...set].sort();
  const t = today(now);
  const recent = addDays(t, -14);
  let run = 0;
  let longest = legacy.longest;
  let freezes = 0;
  let bank = 0;
  let frozen: string[] = [];
  let prev: string | null = null;

  const bridge = (from: string, missed: number): boolean => {
    if (freezes < missed) return false;
    freezes -= missed;
    for (let i = 1; i <= missed; i++) {
      const d = addDays(from, i);
      if (d >= recent) frozen.push(d);
    }
    return true;
  };

  for (const d of list) {
    if (d > t) continue;
    if (prev) {
      const missed = daysBetween(prev, d) - 1;
      if (missed > 0 && !bridge(prev, missed)) {
        run = 0;
        frozen = [];
      }
    }
    run += 1;
    longest = Math.max(longest, run);
    bank += days[d] ?? 0;
    while (bank >= FREEZE_XP) {
      bank -= FREEZE_XP;
      if (freezes < MAX_FREEZES) freezes += 1;
    }
    prev = d;
  }

  if (!prev) return { current: 0, longest, freezes, frozen: [], studiedToday: false };
  // Yesterday or today keeps the run alive as it is; older needs freezes for
  // every day missed since (today itself is not missed yet).
  const missed = daysBetween(prev, t) - 1;
  if (missed > 0 && !bridge(prev, missed)) return { current: 0, longest, freezes, frozen: [], studiedToday: false };
  return { current: run, longest, freezes, frozen, studiedToday: prev === t };
}
