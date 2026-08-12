import { useEffect, useRef } from 'react';

interface DrillKeyboardOptions {
  /** True once there's enough of an answer to submit. */
  canSubmit: boolean;
  /** True once the current question has been checked (right or wrong). */
  hasFeedback: boolean;
  /** True when the checked answer was wrong — the only time Space does anything. */
  isWrong: boolean;
  onSubmit: () => void;
  /** Called on Space while wrong: "I was close enough, count it as right." */
  onOverride: () => void;
  onNext: () => void;
}

/**
 * The keyboard rhythm shared by every drill with a check-then-continue loop:
 * Enter submits the typed answer, or advances once it's been checked; Space,
 * only while the answer is marked wrong, accepts it anyway (a typo, a
 * dialectal variant, a near-miss the grader is too strict to allow) and
 * counts it as correct.
 *
 * A window-level listener rather than an onKeyDown on the input: once
 * feedback shows, the input is disabled and can't receive keystrokes, but
 * Enter and Space still need to work from wherever focus landed.
 */
export function useDrillKeyboard({
  canSubmit,
  hasFeedback,
  isWrong,
  onSubmit,
  onOverride,
  onNext,
}: DrillKeyboardOptions): void {
  const stateRef = useRef({ canSubmit, hasFeedback, isWrong, onSubmit, onOverride, onNext });
  stateRef.current = { canSubmit, hasFeedback, isWrong, onSubmit, onOverride, onNext };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === 'Enter') {
        if (s.hasFeedback) {
          e.preventDefault();
          s.onNext();
        } else if (s.canSubmit) {
          e.preventDefault();
          s.onSubmit();
        }
      } else if (e.code === 'Space' && s.hasFeedback && s.isWrong) {
        // Only intercepted post-feedback, so typing a literal space into an
        // answer beforehand is never affected.
        e.preventDefault();
        s.onOverride();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
