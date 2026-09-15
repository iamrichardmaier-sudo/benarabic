import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { advanceIntensive, REPS_PER_DAY, GAP_HOURS, EXIT_INTERVAL_DAYS } from './intensive';

/**
 * The Scriptable widget carries its own copy of the scheduler, because it runs
 * on the phone with no access to this code. A copy is a thing that drifts, and
 * a drifted copy would quietly put cards on a different schedule depending on
 * which surface graded them — so the copy is executed here and compared.
 */
const SOURCE = readFileSync('scripts/scriptable/wazn-review.js', 'utf8');

function extract(name: string): string {
  const start = SOURCE.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`${name} is missing from the widget`);
  // Walk the braces so the whole body comes out, nested blocks included.
  let depth = 0;
  let i = SOURCE.indexOf('{', start);
  const from = i;
  for (; i < SOURCE.length; i++) {
    if (SOURCE[i] === '{') depth++;
    else if (SOURCE[i] === '}' && --depth === 0) break;
  }
  return SOURCE.slice(start, i + 1) + `\nreturn ${name};`;
}

function constantFromWidget(name: string): unknown {
  const m = SOURCE.match(new RegExp(`const ${name} = ([^;]+);`));
  if (!m) throw new Error(`${name} is missing from the widget`);
  return JSON.parse(m[1].replace(/'/g, '"'));
}

/** The widget's advanceIntensive, lifted out and made callable. */
const widgetAdvance = new Function(
  'isoDay',
  'REPS_PER_DAY',
  'GAP_HOURS',
  'EXIT_INTERVAL_DAYS',
  extract('advanceIntensive'),
)(
  (d: Date) => d.toISOString().slice(0, 10),
  REPS_PER_DAY,
  GAP_HOURS,
  EXIT_INTERVAL_DAYS,
) as (card: { intensive_day: number | null; intensive_reps_done: number }) => {
  intensive_day: number | null;
  intensive_reps_done: number;
  interval_days: number;
  next_review_at: string | null;
};

describe('the widget keeps the same schedule as the app', () => {
  it('agrees on the constants', () => {
    expect(constantFromWidget('REPS_PER_DAY')).toEqual([...REPS_PER_DAY]);
    expect(constantFromWidget('GAP_HOURS')).toBe(GAP_HOURS);
    expect(constantFromWidget('EXIT_INTERVAL_DAYS')).toBe(EXIT_INTERVAL_DAYS);
  });

  it('walks a card through all sixteen reps identically', () => {
    let mine: { intensiveDay: number | null; intensiveRepsDone: number } = {
      intensiveDay: 1,
      intensiveRepsDone: 0,
    };
    let theirs = { intensive_day: 1 as number | null, intensive_reps_done: 0 };

    for (let rep = 1; rep <= 16; rep++) {
      const a = advanceIntensive(mine);
      const b = widgetAdvance(theirs as { intensive_day: number; intensive_reps_done: number });

      expect({ rep, day: a.intensiveDay }).toEqual({ rep, day: b.intensive_day });
      expect({ rep, reps: a.intensiveRepsDone }).toEqual({ rep, reps: b.intensive_reps_done });
      expect({ rep, interval: a.intervalDays }).toEqual({ rep, interval: b.interval_days });
      // Whether a time is set is what decides if the rep is later today or
      // tomorrow, so the two have to agree on it at every step.
      expect({ rep, timed: a.nextReviewAt !== null }).toEqual({
        rep,
        timed: b.next_review_at !== null,
      });

      mine = { intensiveDay: a.intensiveDay, intensiveRepsDone: a.intensiveRepsDone };
      theirs = { intensive_day: b.intensive_day, intensive_reps_done: b.intensive_reps_done };
    }

    // And both have left the phase after exactly sixteen.
    expect(mine.intensiveDay).toBeNull();
    expect(theirs.intensive_day).toBeNull();
  });

  it('asks the server for the cards whose gap has run out', () => {
    // Without this the widget would re-offer a card the moment it was graded.
    expect(SOURCE).toContain('next_review_at.is.null');
    expect(SOURCE).toContain('next_review_at.lte.');
    expect(SOURCE).toContain('"intensive_day", "intensive_reps_done", "next_review_at"');
  });
});
