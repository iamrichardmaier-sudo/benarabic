import { describe, it, expect } from 'vitest';
import { focusAction, focusHint } from './focus-keys';

describe('focusAction', () => {
  it('turns the card over on the right arrow', () => {
    expect(focusAction('ArrowRight', false)).toEqual({ kind: 'flip' });
  });

  it('grades easy on the right arrow once the answer is showing', () => {
    expect(focusAction('ArrowRight', true)).toEqual({ kind: 'grade', rating: 'easy' });
  });

  it('grades again on the left arrow', () => {
    expect(focusAction('ArrowLeft', true)).toEqual({ kind: 'grade', rating: 'again' });
  });

  it('keeps good and hard on the other two arrows', () => {
    expect(focusAction('ArrowUp', true)).toEqual({ kind: 'grade', rating: 'good' });
    expect(focusAction('ArrowDown', true)).toEqual({ kind: 'grade', rating: 'hard' });
  });

  it('grades nothing before the card has been turned over', () => {
    // A rating given before the answer was seen is not a rating of anything.
    for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowDown']) {
      expect(focusAction(key, false)).toBeNull();
    }
  });

  it('never grades on Enter, which is also the key that opens the session', () => {
    // Enter opens focus review, and a held key repeats — grading on it would
    // mark the first card Easy on the way in.
    expect(focusAction('Enter', false)).toEqual({ kind: 'flip' });
    expect(focusAction('Enter', true)).toEqual({ kind: 'flip' });
  });

  it('leaves on Escape from either side', () => {
    expect(focusAction('Escape', false)).toEqual({ kind: 'exit' });
    expect(focusAction('Escape', true)).toEqual({ kind: 'exit' });
  });

  it('ignores everything else', () => {
    expect(focusAction('a', true)).toBeNull();
    expect(focusAction('Tab', false)).toBeNull();
  });
});

describe('focusHint', () => {
  it('says what the next key does, on each side', () => {
    expect(focusHint(false)).toContain('flip');
    expect(focusHint(true)).toContain('Again');
    expect(focusHint(true)).toContain('Easy');
  });
});
