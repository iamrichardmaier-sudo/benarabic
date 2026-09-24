import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import DeckIcon from '@/components/decks/DeckIcon';
import { fetchPodcasts, clock, lengthOf, type Podcast } from '@/lib/podcasts';

/**
 * The podcast shelf at the foot of the Learn screen.
 *
 * A sideways shelf rather than a list, for the same reason the deck
 * categories are: a handful of covers read along in one glance, and the
 * drills above it keep the top of the screen.
 */
const PodcastShelf = ({ onOpen }: { onOpen: (p: Podcast) => void }) => {
  const [podcasts, setPodcasts] = useState<Podcast[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPodcasts()
      .then(setPodcasts)
      .catch((e) => {
        console.error('Podcasts unavailable:', e);
        setError(e instanceof Error ? e.message : 'Podcasts could not be loaded.');
        setPodcasts([]);
      });
  }, []);

  if (podcasts === null) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }
  if (podcasts.length === 0 && !error) return null;

  return (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Podcasts
      </h2>
      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-3">
          {podcasts.map((p) => (
            <button
              key={p.id}
              onClick={() => onOpen(p)}
              className="w-40 shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-start transition-all active:scale-95"
            >
              <span className="flex h-28 items-center justify-center bg-muted/40 text-primary">
                <DeckIcon icon={p.icon} iconUrl={p.iconUrl} size="face" />
              </span>
              <span className="block px-3 py-2.5">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {p.title}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {clock(lengthOf(p, 'both'))}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PodcastShelf;
