import { describe, it, expect, beforeAll, vi } from 'vitest';
import { dismiss, getNowPlaying, installMediaWatcher, registerMedia, setRate } from './now-playing';
import { readPreferences } from './preferences';

beforeAll(() => {
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  window.HTMLMediaElement.prototype.pause = vi.fn();
  installMediaWatcher();
});

function mediaOnPage(tag: 'audio' | 'video', title?: string) {
  const el = document.createElement(tag);
  el.setAttribute('src', `https://x/${tag}.mp3`);
  if (title) el.dataset.title = title;
  document.body.appendChild(el);
  return el;
}

describe('now playing', () => {
  it('follows any audio or video on the page that starts playing', () => {
    const a = mediaOnPage('audio', 'Genesis 1');
    a.dispatchEvent(new Event('play'));
    expect(getNowPlaying()).toMatchObject({ active: true, title: 'Genesis 1', kind: 'audio' });
    const v = mediaOnPage('video');
    v.dispatchEvent(new Event('play'));
    expect(getNowPlaying()).toMatchObject({ active: true, title: 'Video', kind: 'video' });
  });

  it('follows the shared podcast element, which is not on the page', () => {
    const el = new Audio();
    el.setAttribute('src', 'https://x/daily.mp3');
    el.dataset.title = 'Oct 8 — At the Clothing Shop';
    el.dataset.subtitle = 'Daily Audio';
    registerMedia(el);
    el.dispatchEvent(new Event('play'));
    expect(getNowPlaying()).toMatchObject({ title: 'Oct 8 — At the Clothing Shop', subtitle: 'Daily Audio' });
  });

  it('applies and saves one speed for everything, within 0.5–2×', () => {
    const a = mediaOnPage('audio', 'x');
    a.dispatchEvent(new Event('play'));
    setRate(0.75);
    expect(a.playbackRate).toBe(0.75);
    expect(readPreferences().audioRate).toBe(0.75);
    setRate(5);
    expect(a.playbackRate).toBe(2);
    // The next thing to play starts at the chosen speed.
    const b = mediaOnPage('audio', 'y');
    b.dispatchEvent(new Event('play'));
    expect(b.playbackRate).toBe(2);
    setRate(1);
  });

  it('hides when closed, until something plays again', () => {
    const a = mediaOnPage('audio', 'z');
    a.dispatchEvent(new Event('play'));
    dismiss();
    expect(getNowPlaying().active).toBe(false);
    a.dispatchEvent(new Event('play'));
    expect(getNowPlaying().active).toBe(true);
  });
});
