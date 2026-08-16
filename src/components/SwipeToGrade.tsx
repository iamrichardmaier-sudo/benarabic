import { useState, useRef, type ReactNode, type PointerEvent } from 'react';
import type { Rating } from '@/lib/spaced-repetition';

/** How far the card must travel before a release counts as a grade. */
const H_THRESHOLD = 90;
const V_THRESHOLD = 80;

interface SwipeToGradeProps {
  children: ReactNode;
  onGrade: (rating: Rating) => void;
  /** Grading is only meaningful once the answer has been seen. */
  enabled: boolean;
}

const HINTS: Record<Rating, { label: string; className: string }> = {
  again: { label: 'Again', className: 'bg-destructive text-destructive-foreground' },
  hard: { label: 'Hard', className: 'bg-warning text-warning-foreground' },
  good: { label: 'Good', className: 'bg-success text-success-foreground' },
  easy: { label: 'Easy', className: 'bg-info text-info-foreground' },
};

/**
 * Drag-to-grade around a review card.
 *
 * Left = Again, right = Good, up = Easy, down = Hard. These are deliberately
 * NOT mirrored for RTL: dragging left to dismiss is a cross-app convention
 * about rejecting a thing, not about reading order, and mirroring it would
 * collide with what users already do everywhere else on their phone.
 *
 * The gesture is an accelerator, never the only route — the rating buttons stay
 * on screen, so keyboard and assistive-technology users lose nothing, and a
 * learner who never discovers the gesture is not blocked by it.
 */
const SwipeToGrade = ({ children, onGrade, enabled }: SwipeToGradeProps) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const pending = ((): Rating | null => {
    const { x, y } = offset;
    if (Math.abs(x) > Math.abs(y)) {
      if (x <= -H_THRESHOLD) return 'again';
      if (x >= H_THRESHOLD) return 'good';
      return null;
    }
    if (y <= -V_THRESHOLD) return 'easy';
    if (y >= V_THRESHOLD) return 'hard';
    return null;
  })();

  const reset = () => {
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    start.current = null;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    start.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!enabled || !start.current) return;
    setOffset({ x: e.clientX - start.current.x, y: e.clientY - start.current.y });
  };

  const onPointerUp = () => {
    if (!enabled || !start.current) return;
    const rating = pending;
    reset();
    if (rating) onGrade(rating);
  };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={reset}
      className="relative touch-pan-y"
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px) rotate(${offset.x * 0.03}deg)`,
        transition: dragging ? 'none' : 'transform 200ms ease-out',
      }}
    >
      {pending && (
        <span
          aria-hidden="true"
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 rounded-full px-4 py-1.5 text-sm font-bold shadow-lg ${HINTS[pending].className}`}
        >
          {HINTS[pending].label}
        </span>
      )}
      {children}
    </div>
  );
};

export default SwipeToGrade;
