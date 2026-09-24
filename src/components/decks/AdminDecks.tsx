import { useEffect, useState } from 'react';
import { Loader2, Plus, Users, BookMarked, BellDot } from 'lucide-react';
import BackButton from '@/components/BackButton';
import DeckIcon from '@/components/decks/DeckIcon';
import DeckBuilder from '@/components/decks/DeckBuilder';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import { FOUNDATION_ICON } from '@/lib/deck-icons';
import { fetchDeckStats, type Deck, type DeckStat } from '@/lib/deck-store';

/**
 * Deck management, for the one account that can publish.
 *
 * Editing is the same builder everyone else uses — a separate admin editor
 * would be a second thing to keep in step with the first. What is here and
 * nowhere else is the overview: which decks exist including drafts, who has
 * taken each one up, and which learners have asked for theirs to be shared.
 */
const AdminDecks = ({ onBack }: { onBack: () => void }) => {
  const { decks, loading, refresh } = useDeckLibrary();
  const [stats, setStats] = useState<DeckStat[]>([]);
  const [editing, setEditing] = useState<Deck | null>(null);
  const [making, setMaking] = useState(false);

  useEffect(() => {
    fetchDeckStats()
      .then(setStats)
      .catch((err) => console.error('Deck stats unavailable:', err));
  }, [decks]);

  if (making || editing) {
    return (
      <DeckBuilder
        deck={editing}
        admin
        onBack={() => {
          setEditing(null);
          setMaking(false);
        }}
        onSaved={refresh}
      />
    );
  }

  const byId = new Map(stats.map((s) => [s.deckId, s]));
  const requested = decks.filter((d) => d.publishRequested && d.status === 'draft');

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Settings" />

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">Manage decks</h2>
        <p className="text-sm text-muted-foreground">
          Everything that exists, drafts included, and how many people are learning it.
        </p>
      </div>

      <button
        onClick={() => setMaking(true)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95"
      >
        <Plus className="h-4 w-4" />
        New deck
      </button>

      {requested.length > 0 && (
        <section className="space-y-2 rounded-2xl border border-primary/50 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <BellDot className="h-4 w-4 text-primary" />
            {requested.length} deck{requested.length === 1 ? '' : 's'} asking to be shared
          </p>
          {requested.map((d) => (
            <button
              key={d.id}
              onClick={() => setEditing(d)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-start"
            >
              <DeckIcon icon={d.icon} iconUrl={d.iconUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">{d.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {byId.get(d.id)?.words ?? 0} words · review and publish
                </span>
              </span>
            </button>
          ))}
        </section>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
          {decks.map((deck) => {
            const stat = byId.get(deck.id);
            return (
              <button
                key={deck.id}
                onClick={() => setEditing(deck)}
                className="flex w-full items-center gap-3 px-3 py-3 text-start transition-colors hover:bg-muted/40"
              >
                <DeckIcon
                  icon={deck.icon}
                  iconUrl={deck.iconUrl}
                  foundation={deck.icon === FOUNDATION_ICON && !deck.iconUrl}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-foreground">{deck.title}</span>
                  <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookMarked className="h-3 w-3" />
                      {stat?.words ?? deck.wordCount ?? 0}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {stat?.learners ?? 0}
                    </span>
                    <span
                      className={
                        deck.status === 'published' ? 'text-success' : 'text-muted-foreground'
                      }
                    >
                      {deck.status === 'published' ? 'published' : 'draft'}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        A deck has to be published before anyone else sees it in Learn Decks. Unpublishing takes
        it out of the browse list; nobody loses the words they have already learned from it.
      </p>
    </div>
  );
};

export default AdminDecks;
