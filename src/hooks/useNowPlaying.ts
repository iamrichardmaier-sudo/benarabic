import { useSyncExternalStore } from 'react';
import { getNowPlaying, subscribeNowPlaying, type NowPlaying } from '@/lib/now-playing';

/** The audio or video playing anywhere in the app. */
export function useNowPlaying(): NowPlaying {
  return useSyncExternalStore(subscribeNowPlaying, getNowPlaying, getNowPlaying);
}
