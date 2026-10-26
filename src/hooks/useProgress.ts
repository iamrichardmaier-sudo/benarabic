import { useSyncExternalStore } from 'react';
import { getSnapshot, subscribe, type ProgressSnapshot } from '@/lib/progress';

/** XP and background, re-rendering whenever either changes anywhere in the app. */
export function useProgress(): ProgressSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
