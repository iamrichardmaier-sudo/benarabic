import { useSyncExternalStore } from 'react';
import type { DailyAudio } from '@/hooks/useDailyAudios';
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer';

type Player = Pick<ReturnType<typeof usePodcastPlayer>, 'start' | 'stop' | 'state'>;

/**
 * Which shelf episode is playing, and how.
 *
 * Audio — including a video listened to as audio — always goes through the
 * shared audio element, so it survives navigation and a locked screen. Only
 * while a video is actually being watched does its own <video> element play,
 * and then the shared element is stopped: one thing plays at a time.
 */
export interface NowPlaying {
  episode: DailyAudio | null;
  /** 'video' while the video element plays; 'audio' while the shared audio element does. */
  mode: 'audio' | 'video';
  /** The full-screen video view is showing. */
  videoOpen: boolean;
  /** Where the video picks up when it next mounts or is switched back to. */
  resume: { position: number; playing: boolean };
  /** The video element's clock, for the shelf card's progress bar. */
  video: { position: number; duration: number; playing: boolean };
}

const EMPTY: NowPlaying = {
  episode: null,
  mode: 'audio',
  videoOpen: false,
  resume: { position: 0, playing: false },
  video: { position: 0, duration: 0, playing: false },
};

let current: NowPlaying = EMPTY;
const subscribers = new Set<() => void>();

export const getNowPlaying = () => current;

export function setNowPlaying(next: Partial<NowPlaying>) {
  current = { ...current, ...next };
  subscribers.forEach((s) => s());
}

export const resetNowPlaying = () => setNowPlaying(EMPTY);

export function useNowPlaying(): NowPlaying {
  return useSyncExternalStore(
    (cb) => { subscribers.add(cb); return () => { subscribers.delete(cb); }; },
    () => current,
  );
}

/**
 * The shelf episode the shared audio element is playing right now, if any —
 * what the play bar shows. A podcast or anything else that has since taken
 * the element over does not count, so the bar never shows a title that is
 * not what you hear.
 */
export function useBarEpisode(): DailyAudio | null {
  const { episode, mode, videoOpen } = useNowPlaying();
  const { tracks } = usePodcastPlayer('Daily Audio');
  if (!episode || mode !== 'audio' || videoOpen) return null;
  return tracks[0]?.url === episode.audioUrl ? episode : null;
}

const trackOf = (episode: DailyAudio) => [{ url: episode.audioUrl, label: episode.title }];

/** Start an audio episode, replacing whatever was playing — a video included. */
export function playAudio(episode: DailyAudio, player: Pick<Player, 'start'>) {
  setNowPlaying({ ...EMPTY, episode });
  player.start(trackOf(episode));
}

/**
 * Open a video in the video view. The episode already playing (say, as
 * audio only) is switched back to video where it is; any other one starts
 * from the top.
 */
export function openVideo(episode: DailyAudio, player: Player) {
  if (current.episode?.id === episode.id) {
    if (current.mode === 'audio') showVideo(player);
    setNowPlaying({ videoOpen: true });
    return;
  }
  player.stop();
  setNowPlaying({
    ...EMPTY,
    episode,
    mode: 'video',
    videoOpen: true,
    resume: { position: 0, playing: true },
    video: { position: 0, duration: episode.durationSecs ?? 0, playing: false },
  });
}

/**
 * Hand the video's track over to the shared audio element at the same
 * moment, playing or paused as it was — what "Audio only" does.
 */
export function listenAsAudio(player: Pick<Player, 'start'>, from: { position: number; playing: boolean }) {
  const { episode } = current;
  if (!episode) return;
  setNowPlaying({ mode: 'audio', video: { ...current.video, ...from, playing: false } });
  player.start(trackOf(episode), { at: from.position, autoplay: from.playing });
}

/** Take the track back from the shared audio element to the video, where it was. */
export function showVideo(player: Player) {
  const { position, playing } = player.state;
  player.stop();
  setNowPlaying({
    mode: 'video',
    resume: { position, playing },
    video: { ...current.video, position, playing: false },
  });
}

/** Stop everything and put the play bar away. */
export function stopAll(player: Pick<Player, 'stop'>) {
  player.stop();
  resetNowPlaying();
}
