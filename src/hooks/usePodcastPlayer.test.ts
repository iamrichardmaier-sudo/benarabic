import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePodcastPlayer, SKIP_SECONDS, SPEEDS } from './usePodcastPlayer';

type Handler = (() => void) | null;
const handlers: Record<string, Handler> = {};

let play: ReturnType<typeof vi.spyOn>;
let load: ReturnType<typeof vi.spyOn>;

/** The one shared element, found through the calls made on it. */
const element = (): HTMLAudioElement => load.mock.contexts.at(-1) as HTMLAudioElement;

beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  load = vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  // jsdom never loads media, so the length is whatever the test says.
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(600);
  Object.defineProperty(navigator, 'mediaSession', {
    configurable: true,
    value: {
      metadata: null,
      playbackState: 'none',
      setActionHandler: (action: string, fn: Handler) => { handlers[action] = fn; },
    },
  });
  vi.stubGlobal('MediaMetadata', class { constructor(public init: unknown) {} });
});

afterEach(() => {
  const { result } = renderHook(() => usePodcastPlayer('t'));
  act(() => result.current.stop());
  act(() => result.current.setSpeed(1));
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const tracks = [
  { url: 'https://x/one.mp3', label: 'One' },
  { url: 'https://x/two.mp3', label: 'Two' },
];

describe('usePodcastPlayer', () => {
  it('offers every speed from 0.5x to 2x', () => {
    expect([...SPEEDS]).toEqual([0.5, 0.75, 0.8, 0.9, 1, 1.25, 1.5, 2]);
  });

  it('applies the chosen speed to the shared element and reports it', () => {
    const { result } = renderHook(() => usePodcastPlayer('Daily Audio'));
    act(() => result.current.start([tracks[0]]));
    act(() => result.current.setSpeed(1.5));
    expect(element().playbackRate).toBe(1.5);
    expect(result.current.speed).toBe(1.5);
  });

  it('keeps the speed when the next track in a queue starts', () => {
    const { result } = renderHook(() => usePodcastPlayer('Daily Audio'));
    act(() => result.current.start(tracks));
    act(() => result.current.setSpeed(0.75));
    // A new source resets playbackRate to the default rate, as a browser does.
    act(() => { element().playbackRate = element().defaultPlaybackRate; });
    act(() => { element().dispatchEvent(new Event('ended')); });
    expect(result.current.state.index).toBe(1);
    expect(element().src).toBe('https://x/two.mp3');
    expect(element().playbackRate).toBe(0.75);
    expect(element().defaultPlaybackRate).toBe(0.75);
  });

  it('keeps the speed for the next episode started', () => {
    const { result } = renderHook(() => usePodcastPlayer('Daily Audio'));
    act(() => result.current.setSpeed(2));
    act(() => result.current.start([tracks[1]]));
    expect(element().playbackRate).toBe(2);
  });

  it(`skips ${SKIP_SECONDS} seconds either way, within the track`, () => {
    const { result } = renderHook(() => usePodcastPlayer('Daily Audio'));
    act(() => result.current.start([tracks[0]]));
    const el = element();
    el.currentTime = 100;
    act(() => result.current.skip(SKIP_SECONDS));
    expect(el.currentTime).toBe(115);
    act(() => result.current.skip(-SKIP_SECONDS));
    expect(el.currentTime).toBe(100);
    el.currentTime = 5;
    act(() => result.current.skip(-SKIP_SECONDS));
    expect(el.currentTime).toBe(0);
  });

  it('seeks the lock-screen backward/forward buttons by the same 15 seconds', () => {
    const { result } = renderHook(() => usePodcastPlayer('Daily Audio'));
    act(() => result.current.start([tracks[0]]));
    const el = element();
    el.currentTime = 200;
    act(() => handlers.seekforward?.());
    expect(el.currentTime).toBe(215);
    act(() => handlers.seekbackward?.());
    act(() => handlers.seekbackward?.());
    expect(el.currentTime).toBe(185);
  });

  it('starts at a given moment, paused if asked, once the length is known', () => {
    const { result } = renderHook(() => usePodcastPlayer('Daily Audio'));
    play.mockClear();
    act(() => result.current.start([tracks[0]], { at: 42, autoplay: false }));
    expect(play).not.toHaveBeenCalled();
    expect(result.current.state.position).toBe(42);
    act(() => { element().dispatchEvent(new Event('loadedmetadata')); });
    expect(element().currentTime).toBe(42);
    expect(result.current.state.duration).toBe(600);
  });

  it('shares one queue and clock between every screen using it', () => {
    const a = renderHook(() => usePodcastPlayer('Daily Audio'));
    const b = renderHook(() => usePodcastPlayer('Daily Audio'));
    act(() => a.result.current.start([tracks[0]]));
    expect(b.result.current.tracks).toEqual([tracks[0]]);
    act(() => { element().dispatchEvent(new Event('play')); });
    expect(b.result.current.state.playing).toBe(true);
  });
});
