import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBrowserBack } from './useBrowserBack';

/** Fires a real popstate event carrying the given history state, the way the
 *  browser does when the user presses its back button. */
function pressBrowserBack(state: unknown) {
  window.dispatchEvent(new PopStateEvent('popstate', { state }));
}

beforeEach(() => {
  // Each test starts from a clean slate, not wherever the last one left the
  // real browser history for this jsdom window.
  window.history.replaceState(null, '');
});

describe('useBrowserBack', () => {
  it('pushes one history entry per screen change, not on the first render', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook(
      ({ view }) => useBrowserBack(view, view, () => {}, 'home'),
      { initialProps: { view: 'home' } },
    );
    expect(pushSpy).not.toHaveBeenCalled();

    rerender({ view: 'library' });
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy.mock.calls[0][0]).toEqual({ __waznView: 'home' });
  });

  it('does not push again for a re-render that lands on the same screen', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook(
      ({ view }) => useBrowserBack(view, view, () => {}, 'home'),
      { initialProps: { view: 'home' } },
    );
    rerender({ view: 'home' });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('does not push again when only the object identity changes, key held equal', () => {
    // The caller may well pass a fresh object every render (e.g. {tab, view})
    // — only the key is allowed to decide whether anything really changed.
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const { rerender } = renderHook(
      ({ view }) => useBrowserBack({ view }, view, () => {}, { view: 'home' }),
      { initialProps: { view: 'home' } },
    );
    rerender({ view: 'home' });
    expect(pushSpy).not.toHaveBeenCalled();
  });

  it('hands the previous screen back to the caller when the browser goes back', () => {
    const onPop = vi.fn();
    const { rerender } = renderHook(
      ({ view }) => useBrowserBack(view, view, onPop, 'home'),
      { initialProps: { view: 'home' } },
    );
    rerender({ view: 'library' });

    pressBrowserBack({ __waznView: 'home' });
    expect(onPop).toHaveBeenCalledWith('home');
  });

  it('falls back to the given default when there is no further history of its own', () => {
    const onPop = vi.fn();
    renderHook(() => useBrowserBack('home', 'home', onPop, 'home'));

    pressBrowserBack(null);
    expect(onPop).toHaveBeenCalledWith('home');
  });

  it('does not push a new entry for the screen change a pop itself caused', () => {
    // Otherwise every press of the hardware back button would push a fresh
    // entry right back onto the stack it was just popping, and back would
    // never actually go anywhere.
    const pushSpy = vi.spyOn(window.history, 'pushState');
    let view = 'home';
    const onPop = vi.fn((v: string) => { view = v; });
    const { rerender } = renderHook(() => useBrowserBack(view, view, onPop, 'home'));

    view = 'library';
    rerender();
    expect(pushSpy).toHaveBeenCalledTimes(1);

    pressBrowserBack({ __waznView: 'home' });
    rerender();
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });
});
