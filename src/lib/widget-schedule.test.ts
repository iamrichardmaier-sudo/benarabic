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

/**
 * The review page inside the widget is a string of HTML and JavaScript, so it
 * never gets type-checked or bundled. Its grade() is lifted out and run here
 * the same way, because "Again" quietly doing nothing on the phone is exactly
 * the kind of fault that survives a green test run.
 */
function widgetGrade() {
  const state = {
    CARDS: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    i: 0,
    flipped: true,
    results: [] as { id: string; rating: string }[],
    pings: [] as string[],
  };
  const fn = new Function(
    'state',
    `
    let { CARDS, i, flipped, results } = state;
    const ping = (p) => state.pings.push(p);
    const flash = () => {};
    const render = () => {};
    const setTimeout = (f) => {};
    ${extract('grade').replace('\nreturn grade;', '')}
    return function (rating) {
      ({ CARDS, i, flipped, results } = { ...state, flipped: true });
      grade(rating);
      state.i = i;
    };
    `,
  )(state) as (rating: string) => void;
  return { state, grade: fn };
}

describe('the widget sends an "Again" card to the back of the deck', () => {
  it('requeues instead of advancing, and advances on a real grade', () => {
    const { state, grade } = widgetGrade();

    grade('again');
    // The card is still in the session, now last, and the position has not moved.
    expect(state.CARDS.map((c) => c.id)).toEqual(['b', 'c', 'a']);
    expect(state.i).toBe(0);

    grade('easy');
    expect(state.CARDS.map((c) => c.id)).toEqual(['b', 'c', 'a']);
    expect(state.i).toBe(1);
  });

  it('numbers every grade, so a card graded twice is saved twice', () => {
    const { state, grade } = widgetGrade();
    grade('again');
    grade('easy');
    grade('easy');
    expect(state.pings.map((p) => p.match(/seq=(\d+)/)![1])).toEqual(['0', '1', '2']);
    // Two grades for card "a" — the second must not look like a replay.
    expect(state.results.filter((r) => r.id === 'a')).toHaveLength(1);
    expect(state.results).toHaveLength(3);
  });
});

describe('the widget saves a second grade for the same card', () => {
  it('dedupes by sequence rather than by card id', () => {
    // Keying on the id is what made "Again" do nothing: the card came round,
    // was graded, and the write was dropped as a duplicate.
    expect(SOURCE).not.toContain('savedIds');
    expect(SOURCE).toContain('savedSeqs.has(seq)');
  });

  it('chains the writes so the later grade of a repeated card lands last', () => {
    expect(SOURCE).toContain('saveQueue = saveQueue');
  });

  it('still counts a card whose last answer was "Again" as due', () => {
    expect(SOURCE).toContain('lastRating[id] !== "again"');
  });
});

describe('the widget can practise this week\'s words', () => {
  it('asks the server for the recent ones, due or not', () => {
    // Deliberately no next_review_date filter: the point of the practice set
    // is that it does not wait for the schedule.
    expect(SOURCE).toContain('fetchRecentCards');
    expect(SOURCE).toContain('created_at=gte.');
    expect(SOURCE).toContain('learning_stage=eq.graduated');
    const fn = SOURCE.slice(SOURCE.indexOf('async function fetchRecentCards'));
    const body = fn.slice(0, fn.indexOf('\n}'));
    expect(body).not.toContain('next_review_date');
  });

  it('reaches back the same seven days as the app', () => {
    const m = SOURCE.match(/const RECENT_DAYS = (\d+);/);
    expect(m?.[1]).toBe('7');
  });

  it('writes nothing while practising', () => {
    // Both save paths — the live one and the reconciling pass after the sheet
    // is dismissed — have to be shut off, or running the set again would push
    // this week's words further out each time.
    expect(SOURCE).toContain('if (card && !practice && !savedSeqs.has(seq))');
    expect(SOURCE).toContain('if (practice) break;');
  });

  it('leaves the widget count alone after a practice session', () => {
    // The face counts what is owed. Recomputing it from the practice set
    // would show this week's words as the backlog.
    const tail = SOURCE.slice(SOURCE.indexOf('if (practice) {'));
    expect(tail.slice(0, tail.indexOf('return;'))).not.toContain('writeCache');
  });

  it('says on the page that nothing is being rescheduled', () => {
    expect(SOURCE).toContain('nothing is rescheduled');
    expect(SOURCE).toContain('function reviewHTML(cards, practice)');
  });

  it('offers a choice only when there is a choice to make', () => {
    expect(SOURCE).toContain('let practice = due.length === 0;');
    expect(SOURCE).toContain('if (due.length > 0 && recent.length > 0)');
  });
});
