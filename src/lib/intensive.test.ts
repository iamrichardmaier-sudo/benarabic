import { describe, it, expect } from 'vitest';
import {
  REPS_PER_DAY,
  INTENSIVE_DAYS,
  GAP_HOURS,
  EXIT_INTERVAL_DAYS,
  advanceIntensive,
  isIntensive,
  repsForDay,
  startIntensive,
  timeHasCome,
  intensiveProgress,
} from './intensive';
import { isoDay } from './day';

/** A fixed local moment, mid-morning so a 3h gap stays inside the same day. */
const MORNING = new Date(2026, 8, 15, 9, 0, 0);

describe('the shape of the phase', () => {
  it('is four reps a day for three days, then two for two', () => {
    expect([...REPS_PER_DAY]).toEqual([4, 4, 4, 2, 2]);
    expect(INTENSIVE_DAYS).toBe(5);
  });

  it('adds up to sixteen exposures', () => {
    expect(REPS_PER_DAY.reduce((a, b) => a + b, 0)).toBe(16);
  });

  it('has no reps for a day past the end', () => {
    expect(repsForDay(6)).toBe(0);
  });
});

describe('startIntensive', () => {
  it('opens on day one, due immediately', () => {
    const s = startIntensive(MORNING);
    expect(s.intensiveDay).toBe(1);
    expect(s.intensiveRepsDone).toBe(0);
    expect(s.nextReviewDate).toBe(isoDay(MORNING));
    expect(new Date(s.nextReviewAt!).getTime()).toBe(MORNING.getTime());
  });
});

describe('advanceIntensive within a day', () => {
  it('puts the next rep a gap away and leaves the day where it is', () => {
    const s = advanceIntensive({ intensiveDay: 1, intensiveRepsDone: 0 }, MORNING);
    expect(s.intensiveDay).toBe(1);
    expect(s.intensiveRepsDone).toBe(1);
    const gapMs = new Date(s.nextReviewAt!).getTime() - MORNING.getTime();
    expect(gapMs).toBe(GAP_HOURS * 60 * 60 * 1000);
    // Still today, so the widget's date filter keeps offering it.
    expect(s.nextReviewDate).toBe(isoDay(MORNING));
  });

  it('rolls the date forward when the gap crosses midnight', () => {
    const lateNight = new Date(2026, 8, 15, 23, 0, 0);
    const s = advanceIntensive({ intensiveDay: 1, intensiveRepsDone: 0 }, lateNight);
    expect(s.nextReviewDate).toBe('2026-09-16');
  });
});

describe('advanceIntensive at the end of a day', () => {
  it('moves to the next day and hands the date back the decision', () => {
    // Day 1 wants four reps; this is the fourth.
    const s = advanceIntensive({ intensiveDay: 1, intensiveRepsDone: 3 }, MORNING);
    expect(s.intensiveDay).toBe(2);
    expect(s.intensiveRepsDone).toBe(0);
    expect(s.nextReviewAt).toBeNull();
    expect(s.nextReviewDate).toBe('2026-09-16');
    expect(s.intervalDays).toBe(1);
  });

  it('needs only two reps to finish day four', () => {
    const s = advanceIntensive({ intensiveDay: 4, intensiveRepsDone: 1 }, MORNING);
    expect(s.intensiveDay).toBe(5);
  });

  it('leaves the phase after the last rep of day five', () => {
    const s = advanceIntensive({ intensiveDay: 5, intensiveRepsDone: 1 }, MORNING);
    expect(s.intensiveDay).toBeNull();
    expect(s.nextReviewAt).toBeNull();
    expect(s.intervalDays).toBe(EXIT_INTERVAL_DAYS);
    expect(s.nextReviewDate).toBe('2026-09-18');
  });
});

describe('the whole journey', () => {
  it('takes exactly sixteen reps across five days to reach the long-term rotation', () => {
    let state: { intensiveDay: number | null; intensiveRepsDone: number } = {
      intensiveDay: 1,
      intensiveRepsDone: 0,
    };
    const repsOnDay = new Map<number, number>();
    let reps = 0;

    while (state.intensiveDay != null) {
      const day = state.intensiveDay;
      repsOnDay.set(day, (repsOnDay.get(day) ?? 0) + 1);
      reps++;
      state = advanceIntensive(state, MORNING);
      expect(reps).toBeLessThanOrEqual(50); // guard against a schedule that never ends
    }

    expect(reps).toBe(16);
    expect([...repsOnDay.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 4],
      [2, 4],
      [3, 4],
      [4, 2],
      [5, 2],
    ]);
  });
});

describe('isIntensive', () => {
  it('is false for a long-term card and true inside the phase', () => {
    expect(isIntensive({ intensiveDay: null })).toBe(false);
    expect(isIntensive({})).toBe(false);
    expect(isIntensive({ intensiveDay: 3 })).toBe(true);
  });
});

describe('timeHasCome', () => {
  it('lets a card with no time through', () => {
    expect(timeHasCome(null, MORNING)).toBe(true);
    expect(timeHasCome(undefined, MORNING)).toBe(true);
  });

  it('holds a card back until its gap has run out', () => {
    const later = new Date(MORNING.getTime() + 60 * 60 * 1000).toISOString();
    expect(timeHasCome(later, MORNING)).toBe(false);
    expect(timeHasCome(later, new Date(MORNING.getTime() + 2 * 60 * 60 * 1000))).toBe(true);
  });

  it('compares instants, not text', () => {
    // The app writes "…Z" and Postgres hands back "…+00:00". Same moment,
    // different string — and "+00:00" sorts below "Z", so a string compare
    // would call a future card due.
    const at = new Date(MORNING.getTime() + 60 * 60 * 1000);
    const postgresStyle = at.toISOString().replace('Z', '+00:00');
    expect(timeHasCome(postgresStyle, MORNING)).toBe(false);
    expect(timeHasCome(postgresStyle, new Date(at.getTime() + 1000))).toBe(true);
  });

  it('lets an unparseable time through rather than stranding the card', () => {
    expect(timeHasCome('not a date', MORNING)).toBe(true);
  });
});

describe('intensiveProgress', () => {
  it('is null outside the phase', () => {
    expect(intensiveProgress({ intensiveDay: null })).toBeNull();
  });

  it('reports the day and the reps it wants', () => {
    expect(intensiveProgress({ intensiveDay: 4, intensiveRepsDone: 1 })).toEqual({
      day: 4,
      totalDays: 5,
      repsDone: 1,
      repsToday: 2,
    });
  });
});
