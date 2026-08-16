import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { TouchEvent } from 'react';
import { useChapterSwipe } from './useChapterSwipe';

/** Minimal stand-ins for the two React touch events the hook reads. */
const startAt = (x: number, y: number) =>
  ({ touches: [{ clientX: x, clientY: y }] } as unknown as TouchEvent);
const endAt = (x: number, y: number) =>
  ({ changedTouches: [{ clientX: x, clientY: y }] } as unknown as TouchEvent);

let onNext: ReturnType<typeof vi.fn>;
let onPrev: ReturnType<typeof vi.fn>;
let onDoubleTap: ReturnType<typeof vi.fn>;

function setup() {
  onNext = vi.fn();
  onPrev = vi.fn();
  onDoubleTap = vi.fn();
  return renderHook(() => useChapterSwipe({ onNext, onPrev, onDoubleTap })).result;
}

beforeEach(() => {
  vi.useRealTimers();
});

describe('useChapterSwipe', () => {
  it('advances to the next chapter on a rightward drag (RTL page turn)', () => {
    const { current } = setup();
    current.onTouchStart(startAt(100, 200));
    current.onTouchEnd(endAt(220, 205));
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('goes back a chapter on a leftward drag', () => {
    const { current } = setup();
    current.onTouchStart(startAt(220, 200));
    current.onTouchEnd(endAt(100, 205));
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('ignores a drag that is too short to be deliberate', () => {
    const { current } = setup();
    current.onTouchStart(startAt(100, 200));
    current.onTouchEnd(endAt(140, 200));
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('ignores a mostly-vertical drag, so scrolling never turns the page', () => {
    const { current } = setup();
    current.onTouchStart(startAt(100, 100));
    current.onTouchEnd(endAt(180, 400));
    expect(onNext).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('fires the double-tap handler on two quick taps in the same spot', () => {
    const { current } = setup();
    current.onTouchStart(startAt(150, 300));
    current.onTouchEnd(endAt(150, 300));
    current.onTouchStart(startAt(152, 301));
    current.onTouchEnd(endAt(152, 301));
    expect(onDoubleTap).toHaveBeenCalledTimes(1);
  });

  it('does not treat two slow taps as a double-tap', async () => {
    vi.useFakeTimers();
    const { current } = setup();
    current.onTouchStart(startAt(150, 300));
    current.onTouchEnd(endAt(150, 300));
    vi.advanceTimersByTime(600);
    current.onTouchStart(startAt(150, 300));
    current.onTouchEnd(endAt(150, 300));
    expect(onDoubleTap).not.toHaveBeenCalled();
  });

  it('does not mistake a swipe for a tap', () => {
    const { current } = setup();
    current.onTouchStart(startAt(100, 200));
    current.onTouchEnd(endAt(220, 200));
    expect(onDoubleTap).not.toHaveBeenCalled();
  });
});
