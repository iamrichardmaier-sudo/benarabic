import { useState, useEffect } from 'react';

/**
 * `navigator.onLine` proves only that a network interface exists, not that
 * Supabase is reachable. Treat it as a fast hint for skipping calls that are
 * certain to fail, and let actual request failures be the real authority.
 */
export function isOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine;
}

/** Re-renders the caller whenever the browser gains or loses connectivity. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(isOnline);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
