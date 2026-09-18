import { useEffect, useState } from 'react';

/**
 * Whether this looks like a machine with a keyboard and a mouse.
 *
 * Used only to decide whether to mention a keyboard shortcut: a phone has no
 * Enter key to press, and a hint for a key that is not there is noise. The
 * shortcut itself is never gated on this — an iPad with a keyboard attached
 * reports a coarse pointer, and it should still work.
 */
export function useHasKeyboard(): boolean {
  const [has, setHas] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(pointer: fine)');
    setHas(query.matches);
    const onChange = (e: MediaQueryListEvent) => setHas(e.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return has;
}
