import { describe, it, expect, beforeEach } from 'vitest';
import { today, readStreak, currentStreak, recordStudyDay, studiedToday } from './streak';

const U = 'user-1';
const at = (iso: string) => new Date(`${iso}T12:00:00`);

beforeEach(() => {
  localStorage.clear();
});

describe('today', () => {
  it('uses the local calendar day, not UTC', () => {
    // 11pm local on the 5th is still the 5th, even though it is the 6th in UTC
    // for anyone west of Greenwich.
    expect(today(new Date(2026, 4, 5, 23, 30))).toBe('2026-05-05');
  });
});

describe('recordStudyDay', () => {
  it('starts a streak at 1 on the first study day', () => {
    expect(recordStudyDay(U, at('2026-05-01')).current).toBe(1);
  });

  it('is idempotent within the same day', () => {
    recordStudyDay(U, at('2026-05-01'));
    const again = recordStudyDay(U, at('2026-05-01'));
    expect(again.current).toBe(1);
  });

  it('increments on a consecutive day', () => {
    recordStudyDay(U, at('2026-05-01'));
    recordStudyDay(U, at('2026-05-02'));
    expect(recordStudyDay(U, at('2026-05-03')).current).toBe(3);
  });

  it('resets to 1 after a missed day', () => {
    recordStudyDay(U, at('2026-05-01'));
    recordStudyDay(U, at('2026-05-02'));
    expect(recordStudyDay(U, at('2026-05-05')).current).toBe(1);
  });

  it('remembers the longest run even after a reset', () => {
    recordStudyDay(U, at('2026-05-01'));
    recordStudyDay(U, at('2026-05-02'));
    recordStudyDay(U, at('2026-05-03'));
    const after = recordStudyDay(U, at('2026-05-10'));
    expect(after.current).toBe(1);
    expect(after.longest).toBe(3);
  });

  it('keeps streaks separate per user', () => {
    recordStudyDay('a', at('2026-05-01'));
    recordStudyDay('a', at('2026-05-02'));
    expect(readStreak('a').current).toBe(2);
    expect(readStreak('b').current).toBe(0);
  });
});

describe('currentStreak', () => {
  it('still shows the run when the last study day was yesterday', () => {
    recordStudyDay(U, at('2026-05-01'));
    recordStudyDay(U, at('2026-05-02'));
    expect(currentStreak(U, at('2026-05-03')).current).toBe(2);
  });

  it('shows zero once the run has lapsed, without needing a write first', () => {
    recordStudyDay(U, at('2026-05-01'));
    expect(currentStreak(U, at('2026-05-09')).current).toBe(0);
    // the stored longest is untouched by merely displaying a lapsed streak
    expect(currentStreak(U, at('2026-05-09')).longest).toBe(1);
  });
});

describe('studiedToday', () => {
  it('is false before studying and true after', () => {
    expect(studiedToday(U, at('2026-05-01'))).toBe(false);
    recordStudyDay(U, at('2026-05-01'));
    expect(studiedToday(U, at('2026-05-01'))).toBe(true);
  });
});

describe('corrupt storage', () => {
  it('falls back to an empty streak rather than throwing', () => {
    localStorage.setItem('wazn-streak:user-1', '{not json');
    expect(readStreak(U).current).toBe(0);
  });
});
