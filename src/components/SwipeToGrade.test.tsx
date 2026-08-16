import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SwipeToGrade from './SwipeToGrade';

let onGrade: ReturnType<typeof vi.fn>;

function setup(enabled = true) {
  onGrade = vi.fn();
  render(
    <SwipeToGrade onGrade={onGrade} enabled={enabled}>
      <button>card</button>
    </SwipeToGrade>,
  );
  // The drag surface wraps the card content.
  return screen.getByRole('button', { name: 'card' }).parentElement as HTMLElement;
}

/** Press, move to (dx,dy), release. */
function drag(el: HTMLElement, dx: number, dy: number, release = true) {
  fireEvent.pointerDown(el, { clientX: 0, clientY: 0 });
  fireEvent.pointerMove(el, { clientX: dx, clientY: dy });
  if (release) fireEvent.pointerUp(el, { clientX: dx, clientY: dy });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('SwipeToGrade', () => {
  it('grades Again on a decisive leftward drag', () => {
    const el = setup();
    drag(el, -140, 0);
    expect(onGrade).toHaveBeenCalledWith('again');
  });

  it('grades Good on a decisive rightward drag', () => {
    const el = setup();
    drag(el, 140, 0);
    expect(onGrade).toHaveBeenCalledWith('good');
  });

  it('grades Easy on a decisive upward drag', () => {
    const el = setup();
    drag(el, 0, -120);
    expect(onGrade).toHaveBeenCalledWith('easy');
  });

  it('grades Hard on a decisive downward drag', () => {
    const el = setup();
    drag(el, 0, 120);
    expect(onGrade).toHaveBeenCalledWith('hard');
  });

  it('ignores a drag too small to be deliberate', () => {
    const el = setup();
    drag(el, 40, 10);
    expect(onGrade).not.toHaveBeenCalled();
  });

  it('uses the dominant axis when a drag is diagonal', () => {
    const el = setup();
    drag(el, 140, 100); // further horizontally than vertically
    expect(onGrade).toHaveBeenCalledWith('good');
  });

  it('does nothing while the answer is still hidden', () => {
    const el = setup(false);
    drag(el, 200, 0);
    expect(onGrade).not.toHaveBeenCalled();
  });

  it('previews the pending grade mid-drag, before release', () => {
    const el = setup();
    drag(el, 140, 0, false);
    expect(screen.getByText('Good')).toBeInTheDocument();
    expect(onGrade).not.toHaveBeenCalled();
  });

  it('shows no preview until the threshold is crossed', () => {
    const el = setup();
    drag(el, 40, 0, false);
    expect(screen.queryByText('Good')).not.toBeInTheDocument();
  });

  it('abandons the grade if the gesture is cancelled', () => {
    const el = setup();
    fireEvent.pointerDown(el, { clientX: 0, clientY: 0 });
    fireEvent.pointerMove(el, { clientX: 140, clientY: 0 });
    fireEvent.pointerCancel(el);
    fireEvent.pointerUp(el, { clientX: 140, clientY: 0 });
    expect(onGrade).not.toHaveBeenCalled();
  });
});
