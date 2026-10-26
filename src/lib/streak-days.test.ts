import { describe, it, expect } from 'vitest';
import { streakFromDays, FREEZE_XP } from './streak';

const NOW = new Date(2026, 9, 26, 12); // 26 Oct 2026, local

describe('streakFromDays', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(streakFromDays({ '2026-10-24': 10, '2026-10-25': 10, '2026-10-26': 10 }, undefined, NOW)).toMatchObject({ current: 3, studiedToday: true });
    expect(streakFromDays({ '2026-10-24': 10, '2026-10-25': 10 }, undefined, NOW)).toMatchObject({ current: 2, studiedToday: false });
  });

  it('breaks after a missed day without freezes', () => {
    expect(streakFromDays({ '2026-10-22': 10, '2026-10-24': 10 }, undefined, NOW).current).toBe(0);
    expect(streakFromDays({ '2026-10-22': 10, '2026-10-24': 10, '2026-10-25': 10 }, undefined, NOW).current).toBe(2);
  });

  it('bridges a missed day with a freeze earned by XP, and uses it up', () => {
    const s = streakFromDays({ '2026-10-23': FREEZE_XP, '2026-10-25': 10 }, undefined, NOW);
    expect(s).toMatchObject({ current: 2, freezes: 0, frozen: ['2026-10-24'] });
  });

  it('holds at most two freezes', () => {
    expect(streakFromDays({ '2026-10-26': FREEZE_XP * 5 }, undefined, NOW).freezes).toBe(2);
  });

  it('uses freezes for days missed up to today', () => {
    const s = streakFromDays({ '2026-10-22': 10, '2026-10-23': FREEZE_XP * 2 }, undefined, NOW);
    // 24 and 25 missed; today not missed yet.
    expect(s).toMatchObject({ current: 2, freezes: 0, frozen: ['2026-10-24', '2026-10-25'] });
  });

  it('keeps the days the old device-only streak counted', () => {
    const s = streakFromDays({ '2026-10-26': 10 }, { current: 5, longest: 9, lastStudied: '2026-10-25' }, NOW);
    expect(s).toMatchObject({ current: 6, longest: 9 });
  });
});
