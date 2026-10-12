import AudioShelf from './AudioShelf';
import { useDailyAudios } from '@/hooks/useDailyAudios';
import { usePodcastPlayer } from '@/hooks/usePodcastPlayer';

/**
 * The Home audio shelves: the daily lessons, then the AK II textbook chapter
 * exercises. Both come from the one manifest, newest first.
 *
 * Playback goes through the app's one shared audio element, so an episode
 * keeps playing when you leave Home or lock the phone. The shelves share one
 * player so only the episode actually playing shows as active.
 */
const DailyAudios = () => {
  const { daily, chapters, loading, error } = useDailyAudios();
  const player = usePodcastPlayer('Daily Audio');

  return (
    <>
      <AudioShelf
        title="Daily Audios"
        headingId="daily-audios-heading"
        episodes={daily}
        loading={loading}
        error={error}
        player={player}
        errorText="The daily audios could not be loaded."
        emptyText="Your first daily audio arrives tomorrow at 4 AM."
      />
      {/* Hidden until a chapter is published; a load failure is already
          reported by the shelf above. */}
      <AudioShelf
        title="AK II Audios"
        headingId="ak-ii-audios-heading"
        episodes={chapters}
        loading={loading}
        error={error}
        player={player}
      />
    </>
  );
};

export default DailyAudios;
