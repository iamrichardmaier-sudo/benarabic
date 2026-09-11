import { useState, useEffect } from 'react';

/**
 * Whether the on-screen keyboard is currently covering part of the page.
 *
 * `window.innerHeight` does not change when iOS raises the keyboard, but the
 * visual viewport shrinks, so the gap between the two is the keyboard. The
 * threshold keeps browser chrome sliding in and out from counting as one.
 *
 * Answers false where there is no visual viewport to ask — older browsers and
 * jsdom — so a layout that leans on this degrades to its roomy form rather
 * than its cramped one.
 */
export function useKeyboardOpen(threshold = 150): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const check = () => setOpen(window.innerHeight - viewport.height > threshold);
    check();
    viewport.addEventListener('resize', check);
    return () => viewport.removeEventListener('resize', check);
  }, [threshold]);

  return open;
}

/**
 * Whether the pointer is a finger rather than a mouse.
 *
 * Used to offer tap-anywhere shortcuts on a phone without putting invisible
 * click targets in the way of someone using a mouse, who has the button.
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia('(pointer: coarse)');
    const check = () => setCoarse(query.matches);
    check();
    query.addEventListener('change', check);
    return () => query.removeEventListener('change', check);
  }, []);

  return coarse;
}
