import { describe, it, expect } from 'vitest';
import {
  parseWordLine,
  expandGenderVariants,
  acceptedAnswers,
  createCard,
  reviewCard,
  graduateCard,
  getDueCards,
  nextWave,
  scheduleFields,
  type FlashCard,
} from './spaced-repetition';
import { isoDay, daysFromNow } from './day';

describe('parseWordLine', () => {
  it('splits Fusha/Shaami on a real divider', () => {
    expect(parseWordLine('فِطِر / فَطَرَ | to eat breakfast')).toEqual([
      { fusha: 'فِطِر', shaami: 'فَطَرَ', english: 'to eat breakfast' },
    ]);
  });

  it('keeps a masc/fem "/ة" marker intact instead of splitting it', () => {
    expect(parseWordLine('مُفَضَّل/ة | favorite')).toEqual([
      { fusha: 'مُفَضَّل/ة', shaami: null, english: 'favorite' },
    ]);
  });

  it('splits a "ج." plural marker into a second entry sharing the English gloss', () => {
    expect(parseWordLine('نادي ج. نَوادي | club')).toEqual([
      { fusha: 'نادي', shaami: null, english: 'club' },
      { fusha: 'نَوادي', shaami: null, english: 'club' },
    ]);
  });

  it('returns nothing for a blank line', () => {
    expect(parseWordLine('   ')).toEqual([]);
  });

  it('treats a missing "|" as no English gloss', () => {
    expect(parseWordLine('بَاب')).toEqual([{ fusha: 'بَاب', shaami: null, english: null }]);
  });
});

describe('expandGenderVariants', () => {
  it('returns the word unchanged when there is no masc/fem marker', () => {
    expect(expandGenderVariants('كِتَاب')).toEqual(['كِتَاب']);
  });

  it('expands "/ة" into base and feminized variants', () => {
    expect(expandGenderVariants('مُفَضَّل/ة')).toEqual(['مُفَضَّل', 'مُفَضَّلة']);
  });
});

describe('acceptedAnswers', () => {
  const build = (over: Partial<ReturnType<typeof createCard>>) => ({
    ...createCard('جَبَل', 'mountain'),
    ...over,
  });

  it('accepts the singular alone when no other forms exist', () => {
    expect(acceptedAnswers(build({}))).toEqual(['جَبَل']);
  });

  it('accepts Fusha and Shaami in both singular and plural', () => {
    const card = build({ shaami: 'جبل', fushaPlural: 'جِبال', shaamiPlural: 'جبال' });
    expect(acceptedAnswers(card)).toEqual(['جَبَل', 'جبل', 'جِبال', 'جبال']);
  });

  it('expands a masc/fem marker in every form it appears in', () => {
    const card = build({ word: 'عاطِفيّ/ة', fushaPlural: 'عاطِفيّون' });
    expect(acceptedAnswers(card)).toEqual(['عاطِفيّ', 'عاطِفيّة', 'عاطِفيّون']);
  });

  it('splits a field listing several alternatives', () => {
    const card = build({ word: 'جَدّة', shaami: 'سِتّ، تيتة' });
    expect(acceptedAnswers(card)).toEqual(['جَدّة', 'سِتّ', 'تيتة']);
  });

  it('drops duplicates when Fusha and Shaami coincide', () => {
    const card = build({ word: 'بين', shaami: 'بين' });
    expect(acceptedAnswers(card)).toEqual(['بين']);
  });
});

/** A card sitting in the long-term rotation, like the ones already in the deck. */
function longTerm(over: Partial<FlashCard> = {}): FlashCard {
  return {
    ...createCard('كَتَبَ', 'to write'),
    learningStage: 'graduated',
    intervalDays: 40,
    easeFactor: 2.5,
    nextReviewDate: '2020-01-01',
    intensiveDay: null,
    intensiveRepsDone: 0,
    nextReviewAt: null,
    ...over,
  };
}

const MORNING = new Date(2026, 8, 15, 9, 0, 0);

describe('graduateCard', () => {
  it('drops a newly-learned card straight into the front-loaded phase', () => {
    const g = graduateCard(createCard('دَرَسَ'), MORNING);
    expect(g.learningStage).toBe('graduated');
    expect(g.intensiveDay).toBe(1);
    expect(g.intensiveRepsDone).toBe(0);
    // Due the same day, not tomorrow — the first of the day's four reps.
    expect(g.nextReviewDate).toBe(isoDay(MORNING));
    expect(g.nextReviewAt).not.toBeNull();
  });
});

describe('reviewCard inside the phase', () => {
  it('schedules by the phase, not by the interval', () => {
    const card = longTerm({ intensiveDay: 1, intensiveRepsDone: 0, intervalDays: 1 });
    const r = reviewCard(card, 'easy', MORNING);
    expect(r.intensiveDay).toBe(1);
    expect(r.intensiveRepsDone).toBe(1);
    expect(r.intervalDays).toBe(1);
    // "Easy" would have thrown a long-term card weeks out; here it does not.
    expect(r.nextReviewDate).toBe(isoDay(MORNING));
  });

  it('still lets the rating move the ease the card carries out of the phase', () => {
    const card = longTerm({ intensiveDay: 2, intensiveRepsDone: 0, easeFactor: 2.0 });
    expect(reviewCard(card, 'again', MORNING).easeFactor).toBeCloseTo(1.8);
    expect(reviewCard(card, 'easy', MORNING).easeFactor).toBeCloseTo(2.1);
  });

  it('counts every rating as one rep, so the phase is a fixed number of looks', () => {
    const card = longTerm({ intensiveDay: 1, intensiveRepsDone: 1 });
    for (const rating of ['again', 'hard', 'good', 'easy'] as const) {
      expect(reviewCard(card, rating, MORNING).intensiveRepsDone).toBe(2);
    }
  });
});

describe('reviewCard outside the phase', () => {
  it('leaves a long-term card on exactly the schedule it always had', () => {
    const card = longTerm({ intervalDays: 40, easeFactor: 2.5 });
    const r = reviewCard(card, 'good', MORNING);
    expect(r.intervalDays).toBe(100);
    expect(r.nextReviewDate).toBe(daysFromNow(100, MORNING));
    expect(r.intensiveDay).toBeNull();
    expect(r.nextReviewAt).toBeNull();
  });
});

describe('getDueCards', () => {
  it('serves a long-term card whose date has come', () => {
    expect(getDueCards([longTerm()], MORNING)).toHaveLength(1);
  });

  it('holds back a card whose gap has not run out yet', () => {
    const inAnHour = new Date(MORNING.getTime() + 60 * 60 * 1000).toISOString();
    const card = longTerm({
      intensiveDay: 1,
      intensiveRepsDone: 1,
      nextReviewDate: isoDay(MORNING),
      nextReviewAt: inAnHour,
    });
    expect(getDueCards([card], MORNING)).toHaveLength(0);
    // ...and offers it once the gap has passed.
    expect(getDueCards([card], new Date(MORNING.getTime() + 2 * 60 * 60 * 1000))).toHaveLength(1);
  });

  it('never serves a card that has not graduated', () => {
    expect(getDueCards([longTerm({ learningStage: 'stage1' })], MORNING)).toHaveLength(0);
  });
});

describe('scheduleFields', () => {
  it('carries every field the schedule owns, so a review persists whole', () => {
    const card = longTerm({ intensiveDay: 3, intensiveRepsDone: 2, nextReviewAt: 'x' });
    expect(scheduleFields(card)).toEqual({
      learningStage: 'graduated',
      nextReviewDate: card.nextReviewDate,
      intervalDays: card.intervalDays,
      easeFactor: card.easeFactor,
      intensiveDay: 3,
      intensiveRepsDone: 2,
      nextReviewAt: 'x',
    });
  });

  it('writes an explicit null when a card leaves the phase, not undefined', () => {
    // undefined would be dropped by the update builder, leaving the card
    // stuck in the phase forever.
    const left = reviewCard(
      longTerm({ intensiveDay: 5, intensiveRepsDone: 1 }),
      'good',
      MORNING,
    );
    const fields = scheduleFields(left);
    expect(fields.intensiveDay).toBeNull();
    expect(fields.nextReviewAt).toBeNull();
    expect('intensiveDay' in fields).toBe(true);
  });
});

describe('nextWave', () => {
  const inAnHour = new Date(MORNING.getTime() + 60 * 60 * 1000);
  const inTwoHours = new Date(MORNING.getTime() + 2 * 60 * 60 * 1000);

  function held(at: Date): FlashCard {
    return longTerm({
      intensiveDay: 1,
      intensiveRepsDone: 1,
      nextReviewDate: isoDay(MORNING),
      nextReviewAt: at.toISOString(),
    });
  }

  it('is null when nothing is waiting on a gap', () => {
    expect(nextWave([longTerm()], MORNING)).toBeNull();
  });

  it('reports when the next batch comes back, and how big it is', () => {
    const wave = nextWave([held(inTwoHours), held(inAnHour), held(inAnHour)], MORNING);
    expect(wave?.at.getTime()).toBe(inAnHour.getTime());
    // The card an hour later is a separate batch, not part of this one.
    expect(wave?.count).toBe(2);
  });

  it('groups cards a few minutes apart into one batch', () => {
    const nearby = new Date(inAnHour.getTime() + 60 * 1000);
    expect(nextWave([held(inAnHour), held(nearby)], MORNING)?.count).toBe(2);
  });

  it('ignores a card that is already due', () => {
    expect(nextWave([held(new Date(MORNING.getTime() - 1000))], MORNING)).toBeNull();
  });
});
