import { useRef, type TouchEvent } from 'react';

interface Options {
  onNext: () => void;
  onPrev: () => void;
  onDoubleTap?: () => void;
  /** Minimum horizontal travel, in px, before a drag counts as a page turn. */
  threshold?: number;
}

/**
 * Chapter paging by horizontal swipe, plus double-tap.
 *
 * Direction is mirrored for right-to-left reading: in an RTL book the pages
 * turn the opposite way round from a Latin one, so dragging the content to the
 * RIGHT advances to the next chapter, exactly as turning a page in a physical
 * Arabic book does. Getting this backwards is the single most jarring thing a
 * bilingual reader can encounter, so it is deliberately explicit here.
 *
 * A gesture only counts as a page turn when it is decisively horizontal —
 * otherwise ordinary vertical scrolling through a long chapter would keep
 * flipping the page out from under the reader.
 */
export function useChapterSwipe({ onNext, onPrev, onDoubleTap, threshold = 60 }: Options) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef(0);

  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    start.current = { x: t.clientX, y: t.clientY };
  };

  const onTouchEnd = (e: TouchEvent) => {
    const origin = start.current;
    start.current = null;

    const t = e.changedTouches[0];
    if (!t) return;

    // Double-tap: two touches close together in time with almost no travel.
    if (origin) {
      const moved = Math.hypot(t.clientX - origin.x, t.clientY - origin.y);
      if (moved < 10) {
        const now = Date.now();
        if (onDoubleTap && now - lastTap.current < 300) {
          lastTap.current = 0;
          onDoubleTap();
          return;
        }
        lastTap.current = now;
        return;
      }
    }

    if (!origin) return;
    const dx = t.clientX - origin.x;
    const dy = t.clientY - origin.y;

    // Require the gesture to be clearly horizontal, not an imprecise scroll.
    if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    if (dx > 0) onNext(); // RTL: dragging rightwards turns to the next chapter
    else onPrev();
  };

  return { onTouchStart, onTouchEnd };
}
