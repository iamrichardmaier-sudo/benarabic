import { describe, it, expect } from 'vitest';
import {
  LADDER_HOURS,
  LADDER_STEPS,
  EXIT_INTERVAL_DAYS,
  advanceIntensive,
  isIntensive,
  startIntensive,
  timeHasCome,
  intensiveProgress,
} from './intensive';
import { isoDay } from './day';

const HOUR = 60 * 60 * 1000;

/** A fixed local moment, mid-morning. */
const MORNING = new Date(2026, 8, 15, 9, 0, 0);

describe('the shape of the ladder', () => {
  it('is seven reps, the first three inside a day and a half', () => {
    expect([...LADDER_HOURS]).toEqual([12, 12, 24, 24, 24, 48, 72]);
    expect(LADDER_STEPS).toBe(7);
    expect(LADDER_HOURS[0] + LADDER_HOURS[1] + LADDER_HOURS[2]).toBeLessThanOrEqual(48);
  });

  it('is a week and a half long, whatever the learner does in between', () => {
    expect(LADDER_HOURS.reduce((a, b) => a + b, 0) / 24).toBe(9);
  });
});

describe('startIntensive', () => {
  it('opens on rep one, a gap away: learning the word was the first look', () => {
    const s = startIntensive(MORNING);
    expect(s.intensiveDay).toBe(1);
    expect(s.intensiveRepsDone).toBe(0);
    expect(new Date(s.nextReviewAt!).getTime() - MORNING.getTime()).toBe(12 * HOUR);
    expect(s.nextReviewDate).toBe(isoDay(new Date(MORNING.getTime() + 12 * HOUR)));
  });
});

describe('advanceIntensive', () => {
  it('schedules each rep its own gap after the last was done', () => {
    for (let step = 1; step < LADDER_STEPS; step++) {
      const s = advanceIntensive({ intensiveDay: step }, MORNING);
      expect(s.intensiveDay).toBe(step + 1);
      expect(new Date(s.nextReviewAt!).getTime() - MORNING.getTime()).toBe(LADDER_HOURS[step] * HOUR);
      expect(s.intervalDays).toBe(1);
      expect(s.intensiveRepsDone).toBe(0);
    }
  });

  it('puts the date on the day the gap lands in, across midnight too', () => {
    const lateNight = new Date(2026, 8, 15, 23, 0, 0);
    expect(advanceIntensive({ intensiveDay: 1 }, lateNight).nextReviewDate).toBe('2026-09-16');
  });

  it('leaves the ladder after the last rep, onto a week-long interval', () => {
    const s = advanceIntensive({ intensiveDay: LADDER_STEPS }, MORNING);
    expect(s.intensiveDay).toBeNull();
    expect(s.nextReviewAt).toBeNull();
    expect(s.intervalDays).toBe(EXIT_INTERVAL_DAYS);
    expect(s.nextReviewDate).toBe('2026-09-22');
  });

  it('treats a card with no rep number as being on the first', () => {
    expect(advanceIntensive({}, MORNING).intensiveDay).toBe(2);
  });
});

describe('the whole journey', () => {
  it('takes exactly seven reps to reach the long-term rotation, however late they are done', () => {
    // A learner who does each rep a day late climbs the same seven rungs.
    for (const lateness of [0, 5, 30]) {
      let state: { intensiveDay: number | null } = { intensiveDay: startIntensive(MORNING).intensiveDay };
      let reps = 0;
      let now = MORNING;
      while (state.intensiveDay != null) {
        reps++;
        const next = advanceIntensive(state, now);
        state = { intensiveDay: next.intensiveDay };
        if (next.nextReviewAt) now = new Date(new Date(next.nextReviewAt).getTime() + lateness * HOUR);
        expect(reps).toBeLessThanOrEqual(50); // guard against a ladder that never ends
      }
      expect(reps).toBe(7);
    }
  });
});

describe('isIntensive', () => {
  it('is false for a long-term card and true on the ladder', () => {
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
    const later = new Date(MORNING.getTime() + HOUR).toISOString();
    expect(timeHasCome(later, MORNING)).toBe(false);
    expect(timeHasCome(later, new Date(MORNING.getTime() + 2 * HOUR))).toBe(true);
  });

  it('compares instants, not text', () => {
    // The app writes "…Z" and Postgres hands back "…+00:00". Same moment,
    // different string — and "+00:00" sorts below "Z", so a string compare
    // would call a future card due.
    const at = new Date(MORNING.getTime() + HOUR);
    const postgresStyle = at.toISOString().replace('Z', '+00:00');
    expect(timeHasCome(postgresStyle, MORNING)).toBe(false);
    expect(timeHasCome(postgresStyle, new Date(at.getTime() + 1000))).toBe(true);
  });

  it('lets an unparseable time through rather than stranding the card', () => {
    expect(timeHasCome('not a date', MORNING)).toBe(true);
  });
});

describe('intensiveProgress', () => {
  it('is null outside the ladder', () => {
    expect(intensiveProgress({ intensiveDay: null })).toBeNull();
  });

  it('reports the rep the card is due for', () => {
    expect(intensiveProgress({ intensiveDay: 4 })).toEqual({ rep: 4, totalReps: 7 });
  });
});
