import { useEffect, useRef } from 'react';

const STATE_KEY = '__waznView';

/**
 * Makes the hardware/browser back button act like the in-app Back button,
 * for a screen stack that lives in React state rather than the URL.
 *
 * The app switches screens by setting a `View` value in memory — nothing
 * about that touches browser history, so Android back (or a trackpad
 * back-swipe) used to do whatever the browser does by default on a page with
 * no history of its own, typically leaving the app. This pushes one history
 * entry per screen change, carrying the screen being left in its state, and
 * on a pop hands that screen back to the caller to restore. It never changes
 * the URL itself — only the state attached to the current one — so it can't
 * interfere with whatever router already owns routing between pages.
 *
 * @param current The value identifying the screen on display right now —
 *   may be an object; a fresh one every render is fine, see `key`.
 * @param key A primitive that changes if and only if `current` does, since
 *   `current` itself is compared by identity and a literal passed inline
 *   would never be `===` to the last render's.
 * @param onPop Called with the screen to show after the browser goes back.
 * @param fallback Shown when back is pressed with no further history of
 *   ours to unwind — i.e. further back than this hook has ever seen.
 */
export function useBrowserBack<T>(
  current: T,
  key: string | number,
  onPop: (value: T) => void,
  fallback: T,
): void {
  const previous = useRef({ key, value: current });
  const popping = useRef(false);
  const onPopRef = useRef(onPop);
  onPopRef.current = onPop;

  useEffect(() => {
    if (previous.current.key === key) return;
    if (!popping.current) {
      window.history.pushState({ [STATE_KEY]: previous.current.value }, '');
    }
    popping.current = false;
    previous.current = { key, value: current };
    // `current` deliberately left out: a new object each render must not
    // retrigger this on its own, only an actual change in `key` should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      const target = (e.state?.[STATE_KEY] as T | undefined) ?? fallback;
      popping.current = true;
      onPopRef.current(target);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [fallback]);
}
