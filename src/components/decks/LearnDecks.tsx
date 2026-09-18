import { useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import WaznIcon from '@/components/icons/WaznIcon';
import BackButton from '@/components/BackButton';
import DeckIcon from '@/components/decks/DeckIcon';
import DeckPreview from '@/components/decks/DeckPreview';
import PlacementPicker from '@/components/decks/PlacementPicker';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import { FOUNDATION_ICON } from '@/lib/deck-icons';
import type { Deck } from '@/lib/deck-store';
import { matchesDeck } from '@/lib/deck-browse';
import { placementNote, type DeckPlacement } from '@/lib/deck-placement';

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
  const [placement, setPlacement] = useState<DeckPlacement>('learn');

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
      const { decks: n, newCards } = await addDecks([...selected], placement);
      setSelected(new Set());
      setNote(`Added ${n} deck${n === 1 ? '' : 's'} · ${placementNote(placement, newCards)}`);
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
        onAdd={async (chosen) => {
          await addDecks([open.id], chosen);
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
        <WaznIcon name="build" size={30} className="text-primary" />
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visible.map((deck) => {
            const added = mine.has(deck.id);
            const picked = selected.has(deck.id);
            const title = mine.get(deck.id) || deck.title;
            const ownedByViewer = !deck.isAdminDeck && deck.createdBy !== null;
            const foundation = deck.icon === FOUNDATION_ICON;
            return (
              <div
                key={deck.id}
                className={`relative overflow-hidden rounded-2xl border bg-card transition-colors ${
                  picked ? 'border-primary ring-2 ring-primary/25' : 'border-border'
                } ${added ? 'opacity-70' : ''}`}
              >
                {/* Tapping the card opens the deck; the tick in the corner is
                    for taking several at once without opening any of them. */}
                <button
                  onClick={() => (ownedByViewer && onEditDeck ? onEditDeck(deck) : setOpen(deck))}
                  className="flex w-full flex-col items-stretch text-start"
                >
                  <span
                    className={`flex h-28 items-center justify-center ${
                      foundation ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-primary'
                    }`}
                  >
                    <DeckIcon icon={deck.icon} foundation={foundation} size="face" />
                  </span>
                  <span className="min-w-0 px-3 py-2.5">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {deck.wordCount ?? 0} word{deck.wordCount === 1 ? '' : 's'}
                      {deck.status === 'draft' && ' · draft'}
                    </span>
                  </span>
                </button>

                {added ? (
                  <span className="absolute end-2 top-2 flex items-center gap-1 rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-success-foreground">
                    <Check className="h-3 w-3" />
                    Added
                  </span>
                ) : (
                  <label className="absolute end-2 top-2 cursor-pointer rounded-lg bg-background/85 p-1.5 backdrop-blur">
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => toggle(deck.id)}
                      aria-label={`Select ${deck.title}`}
                      className="block h-4 w-4 accent-primary"
                    />
                  </label>
                )}
              </div>
            );
          })}
          {visible.length === 0 && (
            <p className="col-span-full px-4 py-10 text-center text-sm text-muted-foreground">
              {query ? 'No deck matches that.' : 'No decks yet.'}
            </p>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="space-y-2">
          <PlacementPicker value={placement} onChange={setPlacement} />
          <button
            onClick={addSelected}
            disabled={busy}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Add {selected.size} deck{selected.size === 1 ? '' : 's'}
          </button>
        </div>
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
