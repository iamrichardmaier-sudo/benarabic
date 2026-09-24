import { describe, it, expect } from 'vitest';
import { available, tracksFor, clock, lengthOf, type Podcast } from './podcasts';

function pod(over: Partial<Podcast> = {}): Podcast {
  return {
    id: 'p1',
    title: 'II Chapter 1 podcast',
    subtitle: null,
    deckId: null,
    icon: 'mihrab',
    iconUrl: null,
    shaamiUrl: 'https://example.test/sh.mp3',
    fushaUrl: 'https://example.test/fu.mp3',
    shaamiSeconds: 1498,
    fushaSeconds: 1577,
    ...over,
  };
}

describe('which registers are on offer', () => {
  it('offers both halves and the pair when both exist', () => {
    expect(available(pod())).toEqual(['shaami', 'fusha', 'both']);
  });

  it('does not offer a half that has no audio', () => {
    expect(available(pod({ fushaUrl: null }))).toEqual(['shaami']);
  });

  it('offers nothing at all before anything is uploaded', () => {
    // The row exists before the files do, so this is the ordinary early state
    // rather than an error.
    expect(available(pod({ shaamiUrl: null, fushaUrl: null }))).toEqual([]);
  });
});

describe('what gets played', () => {
  it('plays one file for one register', () => {
    expect(tracksFor(pod(), 'fusha').map((t) => t.label)).toEqual(['Fuṣḥā']);
  });

  it('plays Shaami before Fuṣḥā when both are asked for', () => {
    // Order is the lesson: the same material heard twice, spoken first.
    expect(tracksFor(pod(), 'both').map((t) => t.label)).toEqual(['Shaami', 'Fuṣḥā']);
  });

  it('drops a missing half from the pair rather than queueing nothing', () => {
    expect(tracksFor(pod({ shaamiUrl: null }), 'both').map((t) => t.label)).toEqual(['Fuṣḥā']);
  });
});

describe('how long it runs', () => {
  it('adds the halves together for both', () => {
    expect(lengthOf(pod(), 'both')).toBe(1498 + 1577);
  });

  it('will not guess a total when a half is unknown', () => {
    expect(lengthOf(pod({ fushaSeconds: null }), 'both')).toBeNull();
  });

  it('shows minutes and seconds, and hours once it runs that long', () => {
    expect(clock(1498)).toBe('24:58');
    expect(clock(3075)).toBe('51:15');
    expect(clock(3675)).toBe('1:01:15');
  });

  it('says so rather than showing a zero when the length is unknown', () => {
    expect(clock(null)).toBe('--:--');
    expect(clock(NaN)).toBe('--:--');
  });
});
