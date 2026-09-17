import { useMemo, useState } from 'react';
import { Check, Hammer, Loader2, Search, X } from 'lucide-react';
import BackButton from '@/components/BackButton';
import DeckIcon from '@/components/decks/DeckIcon';
import DeckPreview from '@/components/decks/DeckPreview';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import { FOUNDATION_ICON } from '@/lib/deck-icons';
import type { Deck } from '@/lib/deck-store';
import { matchesDeck } from '@/lib/deck-browse';

interface LearnDecksProps {
  onBack: () => void;
  onBuildDeck: () => void;
  /** Opens a deck the viewer owns in the builder rather than the preview. */
  onEditDeck?: (deck: Deck) => void;
}

/**
 * The deck shelf: everything published, plus your own.
 *
 * A screen of its own rather than a corner of the Library, because choosing
 * what to learn is not the same activity as reading — and it is the only
 * place words enter a deck now that the old search-and-add flow is gone.
 */
const LearnDecks = ({ onBack, onBuildDeck, onEditDeck }: LearnDecksProps) => {
  const { decks, mine, admin, loading, error, addDecks, removeDeck } = useDeckLibrary();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Deck | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      decks
        // A draft is only ever the admin's own work in progress; it has no
        // business in a browse list of things to learn.
        .filter((d) => d.status === 'published' || d.createdBy !== null)
        .filter((d) => matchesDeck(d, query)),
    [decks, query],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { decks: n, newCards } = await addDecks([...selected]);
      setSelected(new Set());
      setNote(
        `Added ${n} deck${n === 1 ? '' : 's'} · ${newCards} new word${newCards === 1 ? '' : 's'} waiting in Learn`,
      );
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Those decks could not be added.');
    } finally {
      setBusy(false);
    }
  };

  if (open) {
    return (
      <DeckPreview
        deck={open}
        added={mine.has(open.id)}
        onBack={() => setOpen(null)}
        onAdd={async () => {
          await addDecks([open.id]);
        }}
        onRemove={async () => {
          await removeDeck(open.id);
          setOpen(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Home" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Learn Decks</h1>
        <p className="text-sm text-muted-foreground">
          Pick up a chapter's words, or build a deck of your own.
        </p>
      </div>

      <button
        onClick={onBuildDeck}
        className="flex w-full items-center gap-3 rounded-2xl border border-primary bg-card px-4 py-3.5 text-start transition-all active:scale-95 hover:bg-muted/40"
      >
        <Hammer className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-foreground">Build your own deck</span>
          <span className="block text-xs text-muted-foreground">
            Pull words from the shared bank, or add your own
          </span>
        </span>
      </button>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Find a deck or chapter number"
          aria-label="Find a deck"
          className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            aria-label="Clear the search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {note && (
        <p className="rounded-xl border border-border bg-card px-4 py-2.5 text-center text-xs text-muted-foreground">
          {note}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}

      {!loading && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
          {visible.map((deck) => {
            const added = mine.has(deck.id);
            const picked = selected.has(deck.id);
            const title = mine.get(deck.id) || deck.title;
            const ownedByViewer = !deck.isAdminDeck && deck.createdBy !== null;
            return (
              <div key={deck.id} className={`flex items-center gap-3 px-3 ${added ? 'opacity-60' : ''}`}>
                {/* Ticking is for adding several at once; tapping the row
                    opens the deck so its words can be read first. */}
                {!added && (
                  <input
                    type="checkbox"
                    checked={picked}
                    onChange={() => toggle(deck.id)}
                    aria-label={`Select ${deck.title}`}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                )}
                <button
                  onClick={() =>
                    ownedByViewer && onEditDeck ? onEditDeck(deck) : setOpen(deck)
                  }
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 text-start"
                >
                  <DeckIcon icon={deck.icon} foundation={deck.icon === FOUNDATION_ICON} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-foreground">{title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {deck.wordCount ?? 0} word{deck.wordCount === 1 ? '' : 's'}
                      {deck.status === 'draft' && ' · draft'}
                      {deck.publishRequested && deck.status === 'draft' && ' · awaiting review'}
                    </span>
                  </span>
                  {added && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-success">
                      <Check className="h-3.5 w-3.5" />
                      Added
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {query ? 'No deck matches that.' : 'No decks yet.'}
            </p>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <button
          onClick={addSelected}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Add {selected.size} deck{selected.size === 1 ? '' : 's'} to Learn
        </button>
      )}

      {admin && (
        <p className="text-center text-[11px] text-muted-foreground">
          You are signed in as the admin — decks you build can be published for everyone.
        </p>
      )}
    </div>
  );
};

export default LearnDecks;
