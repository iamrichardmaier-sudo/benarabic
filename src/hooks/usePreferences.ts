import { useSyncExternalStore } from 'react';
import { readPreferences, subscribePreferences, type Preferences } from '@/lib/preferences';

// useSyncExternalStore needs a stable snapshot: returning a fresh object on
// every call would loop forever, so the snapshot is memoised and only replaced
// when a value actually differs.
let snapshot: Preferences = readPreferences();

function getSnapshot(): Preferences {
  const next = readPreferences();
  if (
    next.textScale !== snapshot.textScale ||
    next.audioRate !== snapshot.audioRate ||
    next.theme !== snapshot.theme ||
    next.dialect !== snapshot.dialect
  ) {
    snapshot = next;
  }
  return snapshot;
}

/** Live preferences, shared between the Settings screen and in-reader controls. */
export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribePreferences, getSnapshot, getSnapshot);
}
