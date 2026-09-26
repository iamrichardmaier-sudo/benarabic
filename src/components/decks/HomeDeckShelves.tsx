import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import DeckIcon from '@/components/decks/DeckIcon';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import { useToast } from '@/hooks/use-toast';
import { FOUNDATION_ICON } from '@/lib/deck-icons';
import { placementNote } from '@/lib/deck-placement';
import type { Deck } from '@/lib/deck-store';

/**
 * Two browsable shelves right on Home: the Al-Kitab chapters, and everything
 * else. Tapping an unadded deck takes it up immediately — Home is a place to
 * glance and go, not to stop and read a preview first. Learn Decks still has
 * the full browse-and-preview flow for anyone who wants it.
 */
const HomeDeckShelves = () => {
  const { decks, mine, loading, addDecks } = useDeckLibrary();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(
    () => decks.filter((d) => d.status === 'published' || d.createdBy !== null),
    [decks],
  );

  const alKitab = useMemo(
    () => visible.filter((d) => d.bookPartPrefix || d.chapterRange),
    [visible],
  );
  const other = useMemo(
    () => visible.filter((d) => !d.bookPartPrefix && !d.chapterRange),
    [visible],
  );

  const add = async (deck: Deck) => {
    if (mine.has(deck.id) || busy) return;
    setBusy(deck.id);
    try {
      const { newCards } = await addDecks([deck.id]);
      toast({ title: `Added ${deck.title}`, description: placementNote('learn', newCards) });
    } catch (err) {
      toast({
        title: 'Could not add that deck',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const card = (deck: Deck) => {
    const added = mine.has(deck.id);
    const foundation = deck.icon === FOUNDATION_ICON && !deck.iconUrl;
    return (
      <button
        key={deck.id}
        onClick={() => add(deck)}
        disabled={busy === deck.id}
        className={`relative w-32 shrink-0 overflow-hidden rounded-2xl border text-start transition-all active:scale-95 ${
          added ? 'border-border opacity-70' : 'border-border hover:bg-muted/40'
        }`}
      >
        <span
          className={`flex h-20 items-center justify-center ${
            foundation ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-primary'
          }`}
        >
          <DeckIcon icon={deck.icon} iconUrl={deck.iconUrl} foundation={foundation} size="md" />
        </span>
        <span className="block min-w-0 px-2.5 py-2">
          <span className="block truncate text-xs font-semibold text-foreground">{deck.title}</span>
          <span className="block text-[11px] text-muted-foreground">
            {deck.wordCount ?? 0} word{deck.wordCount === 1 ? '' : 's'}
          </span>
        </span>
        {added && (
          <span className="absolute end-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-success px-1.5 py-0.5 text-[9px] font-semibold text-success-foreground">
            <Check className="h-2.5 w-2.5" />
            Added
          </span>
        )}
      </button>
    );
  };

  const shelf = (title: string, deckList: Deck[]) => {
    if (deckList.length === 0) return null;
    return (
      <section key={title} className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        <div className="-mx-5 overflow-x-auto px-5 pb-1">
          <div className="flex w-max gap-3">{deckList.map(card)}</div>
        </div>
      </section>
    );
  };

  if (loading || visible.length === 0) return null;

  return (
    // The desktop layout covers decks in HomeDesktopColumns' Vocabulary
    // column instead, styled as cards with a progress bar rather than a
    // scrolling shelf.
    <div className="space-y-4 lg:hidden">
      {shelf('Al-Kitab chapters', alKitab)}
      {shelf('Other decks', other)}
    </div>
  );
};

export default HomeDeckShelves;
