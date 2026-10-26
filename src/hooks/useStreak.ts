import { useMemo } from 'react';
import { useProgress } from '@/hooks/useProgress';
import { readStreak, streakFromDays, today, type DayStreak } from '@/lib/streak';

/** The study streak, from XP earned on every device and the widget. */
export function useStreak(userId?: string): DayStreak {
  const { days } = useProgress();
  const day = today();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `day` re-runs it after midnight
  return useMemo(() => streakFromDays(days, readStreak(userId)), [days, userId, day]);
}

/** XP earned today. */
export function useTodayXp(): number {
  return useProgress().days[today()] ?? 0;
}
