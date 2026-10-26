import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import type { DailyAudio } from '@/hooks/useDailyAudios';

const hook = vi.hoisted(() => ({
  value: { daily: [] as DailyAudio[], chapters: [] as DailyAudio[], loading: false, error: null as string | null },
}));
vi.mock('@/hooks/useDailyAudios', () => ({ useDailyAudios: () => hook.value }));

import DailyAudios from './DailyAudios';
import NowPlayingBar from './NowPlayingBar';
import VideoPlayerView from './VideoPlayerView';
import { resetNowPlaying } from '@/hooks/useNowPlaying';
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer';
import { renderHook } from '@testing-library/react';

/*
 * jsdom never plays media, so play/pause are faked closely enough to drive
 * the real players: they flip `paused` and fire the events a browser would.
 */
const paused = new WeakMap<HTMLMediaElement, boolean>();
const loads: HTMLMediaElement[] = [];

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, 'paused', 'get').mockImplementation(function (this: HTMLMediaElement) {
    return paused.get(this) ?? true;
  });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function (this: HTMLMediaElement) {
    paused.set(this, false);
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function (this: HTMLMediaElement) {
    if (paused.get(this) === false) {
      paused.set(this, true);
      this.dispatchEvent(new Event('pause'));
    }
  });
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(function (this: HTMLMediaElement) {
    loads.push(this);
    paused.set(this, true);
  });
  vi.spyOn(HTMLMediaElement.prototype, 'duration', 'get').mockReturnValue(600);
});

afterEach(() => {
  const { result } = renderHook(() => usePodcastPlayer('t'));
  act(() => { result.current.stop(); result.current.setSpeed(1); });
  act(() => resetNowPlaying());
  loads.length = 0;
  vi.restoreAllMocks();
});

/** The shared audio element — the only media element that is ever load()ed here. */
const sharedAudio = () => loads.find((el) => el instanceof HTMLAudioElement)!;

const episode = (over: Partial<DailyAudio> = {}): DailyAudio => ({
  id: '2026-10-08',
  audioDate: '2026-10-08',
  title: 'Oct 8 — At the Clothing Shop',
  audioUrl: 'https://x/2026-10-08.mp3',
  imageUrl: 'https://x/art/2026-10-08.png',
  durationSecs: 600,
  collection: null,
  ...over,
});

const video = episode({
  id: '2026-10-20-souq',
  title: 'Oct 20 — At the Souq',
  audioUrl: 'https://x/souq.mp3',
  imageUrl: 'https://x/art/souq.png',
  mediaType: 'video',
  videoUrl: 'https://x/souq.mp4',
});

/** Home, plus the parts of the app shell that outlive it. */
const App = ({ home = true }: { home?: boolean }) => (
  <>
    {home && <DailyAudios />}
    <NowPlayingBar />
    <VideoPlayerView />
  </>
);

const bar = () => screen.getByRole('region', { name: 'Now playing' });

describe('the play bar', () => {
  beforeEach(() => {
    hook.value = { daily: [episode(), video], chapters: [], loading: false, error: null };
  });

  it('appears with the cover and title when an episode starts, and stays when Home goes away', () => {
    const { rerender } = render(<App />);
    expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Play Oct 8 — At the Clothing Shop' }));
    expect(within(bar()).getByText('Oct 8 — At the Clothing Shop')).toBeInTheDocument();
    expect(bar().querySelector('img')).toHaveAttribute('src', 'https://x/art/2026-10-08.png');

    // Another screen: the shelves unmount, the bar and the audio carry on.
    rerender(<App home={false} />);
    expect(within(bar()).getByText('Oct 8 — At the Clothing Shop')).toBeInTheDocument();
    expect(within(bar()).getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    expect(sharedAudio().paused).toBe(false);
  });

  it('plays and pauses, skips 15 seconds, and seeks', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Oct 8 — At the Clothing Shop' }));
    act(() => { sharedAudio().dispatchEvent(new Event('loadedmetadata')); });
    const el = sharedAudio();

    fireEvent.click(within(bar()).getByRole('button', { name: 'Pause' }));
    expect(el.paused).toBe(true);
    fireEvent.click(within(bar()).getByRole('button', { name: 'Play' }));
    expect(el.paused).toBe(false);

    el.currentTime = 100;
    fireEvent.click(within(bar()).getByRole('button', { name: 'Forward 15 seconds' }));
    expect(el.currentTime).toBe(115);
    fireEvent.click(within(bar()).getByRole('button', { name: 'Back 15 seconds' }));
    expect(el.currentTime).toBe(100);

    fireEvent.change(within(bar()).getByRole('slider', { name: 'Seek' }), { target: { value: '300' } });
    expect(el.currentTime).toBe(300);
  });

  it('changes speed from the speed control and keeps it for the next episode', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Oct 8 — At the Clothing Shop' }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Playback speed, 1×' }));
    const options = within(screen.getByRole('group', { name: 'Playback speed' })).getAllByRole('button');
    expect(options.map((o) => o.textContent)).toEqual(['0.5×', '0.75×', '0.8×', '0.9×', '1×', '1.25×', '1.5×', '2×']);

    fireEvent.click(screen.getByRole('button', { name: '1.25×' }));
    expect(sharedAudio().playbackRate).toBe(1.25);
    expect(within(bar()).getByRole('button', { name: 'Playback speed, 1.25×' })).toBeInTheDocument();
  });

  it('stops and goes away from its close button', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Oct 8 — At the Clothing Shop' }));
    fireEvent.click(within(bar()).getByRole('button', { name: 'Stop and close player' }));
    expect(screen.queryByRole('region', { name: 'Now playing' })).not.toBeInTheDocument();
    expect(sharedAudio().paused).toBe(true);
  });
});

describe('video items', () => {
  beforeEach(() => {
    hook.value = { daily: [episode()], chapters: [video], loading: false, error: null };
  });

  const videoEl = () => screen.getByLabelText('Video: Oct 20 — At the Souq') as HTMLVideoElement;
  const dialog = () => screen.getByRole('dialog', { name: 'Oct 20 — At the Souq' });

  it('shows a video badge on its card, on the AK II shelf', () => {
    render(<App />);
    const akii = screen.getByRole('region', { name: 'AK II Audios' });
    expect(within(akii).getByRole('button', { name: 'Watch Oct 20 — At the Souq' })).toBeInTheDocument();
    expect(within(akii).getByText('Video')).toBeInTheDocument();
    const daily = screen.getByRole('region', { name: 'Daily Audios' });
    expect(within(daily).queryByText('Video')).not.toBeInTheDocument();
  });

  it('opens the video player, stopping any audio that was playing', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Play Oct 8 — At the Clothing Shop' }));
    expect(sharedAudio().paused).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Watch Oct 20 — At the Souq' }));
    expect(dialog()).toBeInTheDocument();
    expect(videoEl()).toHaveAttribute('src', 'https://x/souq.mp4');
    expect(videoEl().paused).toBe(false);
    expect(sharedAudio().paused).toBe(true);
    expect(within(dialog()).getByRole('button', { name: 'Audio only' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: 'Forward 15 seconds' })).toBeInTheDocument();
    expect(within(dialog()).getByRole('slider', { name: 'Seek' })).toBeInTheDocument();
  });

  it('drives the video with skip, seek and speed', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch Oct 20 — At the Souq' }));
    act(() => { videoEl().dispatchEvent(new Event('loadedmetadata')); });
    videoEl().currentTime = 60;
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Forward 15 seconds' }));
    expect(videoEl().currentTime).toBe(75);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Back 15 seconds' }));
    expect(videoEl().currentTime).toBe(60);
    fireEvent.change(within(dialog()).getByRole('slider', { name: 'Seek' }), { target: { value: '200' } });
    expect(videoEl().currentTime).toBe(200);
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Pause' }));
    expect(videoEl().paused).toBe(true);

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Playback speed, 1×' }));
    fireEvent.click(screen.getByRole('button', { name: '0.8×' }));
    expect(videoEl().playbackRate).toBe(0.8);
  });

  it('switches to audio only and back at the same moment, still playing', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch Oct 20 — At the Souq' }));
    act(() => { videoEl().dispatchEvent(new Event('loadedmetadata')); });
    videoEl().currentTime = 73;

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Audio only' }));
    // The video stops; the same track carries on through the shared element.
    expect(videoEl().paused).toBe(true);
    const el = sharedAudio();
    expect(el.src).toBe('https://x/souq.mp3');
    expect(el.paused).toBe(false);
    act(() => { el.dispatchEvent(new Event('loadedmetadata')); });
    expect(el.currentTime).toBe(73);
    expect(within(dialog()).getByRole('button', { name: 'Audio only' })).toHaveAttribute('aria-pressed', 'true');

    // Twenty seconds later, back to the picture.
    el.currentTime = 93;
    act(() => { el.dispatchEvent(new Event('timeupdate')); });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Audio only' }));
    expect(el.paused).toBe(true);
    expect(videoEl().currentTime).toBe(93);
    expect(videoEl().paused).toBe(false);
  });

  it('keeps a paused video paused across the switch', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch Oct 20 — At the Souq' }));
    act(() => { videoEl().dispatchEvent(new Event('loadedmetadata')); });
    videoEl().currentTime = 40;
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Pause' }));

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Audio only' }));
    const el = sharedAudio();
    expect(el.paused).toBe(true);
    act(() => { el.dispatchEvent(new Event('loadedmetadata')); });
    expect(el.currentTime).toBe(40);

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Audio only' }));
    expect(videoEl().currentTime).toBe(40);
    expect(videoEl().paused).toBe(true);
  });

  it('carries on as audio in the play bar when minimized, and reopens where it was', () => {
    const { rerender } = render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Watch Oct 20 — At the Souq' }));
    act(() => { videoEl().dispatchEvent(new Event('loadedmetadata')); });
    videoEl().currentTime = 120;
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Audio only' }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Minimize' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(bar()).getByText('Oct 20 — At the Souq')).toBeInTheDocument();
    expect(bar().querySelector('img')).toHaveAttribute('src', 'https://x/art/souq.png');
    const el = sharedAudio();
    expect(el.paused).toBe(false);

    // Off Home, it keeps going; the card's progress follows it on return.
    rerender(<App home={false} />);
    act(() => { el.dispatchEvent(new Event('loadedmetadata')); });
    el.currentTime = 150;
    act(() => { el.dispatchEvent(new Event('timeupdate')); });
    rerender(<App />);
    const card = screen.getByRole('button', { name: 'Watch Oct 20 — At the Souq' });
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '25');

    // Reopening from the bar brings the picture back at the same moment.
    fireEvent.click(within(bar()).getByRole('button', { name: 'Watch video' }));
    expect(videoEl().currentTime).toBe(150);
    expect(videoEl().paused).toBe(false);
    expect(el.paused).toBe(true);
  });
});
