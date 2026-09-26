import { useEffect, useMemo, useState } from 'react';
import {
  Sparkles, Link2, Hash, Brain, Headphones, Check, type LucideIcon,
} from 'lucide-react';
import DeckIcon from '@/components/decks/DeckIcon';
import { useDeckLibrary } from '@/hooks/useDeckLibrary';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { FOUNDATION_ICON } from '@/lib/deck-icons';
import { placementNote } from '@/lib/deck-placement';
import { fetchDeckProgress, type Deck, type DeckProgress } from '@/lib/deck-store';
import type { LearnDestination } from '@/components/LearnHub';

interface PracticeItem {
  id: LearnDestination;
  label: string;
  hint: string;
  icon: LucideIcon;
}

/** The same drills and memorization tools LearnHub lists, as cards rather
 *  than list rows -- there is no natural progress metric for a drill, so
 *  these carry a hint instead of a bar. */
const PRACTICE_ITEMS: PracticeItem[] = [
  { id: 'conjugationDrill', label: 'Drill conjugations', icon: Sparkles, hint: 'Past, present and masdar by form' },
  { id: 'prepositionDrill', label: 'Drill prepositions', icon: Link2, hint: 'Verbs that take a fixed preposition' },
  { id: 'numbersDrill', label: 'Drill numbers and plurals', icon: Hash, hint: 'Counting, and the gender the numeral takes' },
  { id: 'memorize', label: 'Memorize a transcript', icon: Brain, hint: 'Hide words and recall the passage' },
  { id: 'listenCards', label: 'Listen to cards', icon: Headphones, hint: 'Play a set on a loop, hands-free' },
];

/**
 * Desktop only: a wide two-column dashboard below Home's usual stack --
 * practice tools on the left, decks on the right as cards with a real
 * progress bar (words reviewed at least once, out of the deck's size).
 * Hidden below the `lg` breakpoint, where `HomeDeckShelves` covers decks
 * instead.
 */
const HomeDesktopColumns = ({ onSelect }: { onSelect: (destination: LearnDestination) => void }) => {
  const { user } = useAuth();
  const { decks, mine, loading, addDecks } = useDeckLibrary();
  const { toast } = useToast();
  const [progress, setProgress] = useState<Map<string, DeckProgress>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);

  const visible = useMemo(
    () => decks.filter((d) => d.status === 'published' || d.createdBy !== null),
    [decks],
  );
  const addedIds = useMemo(
    () => visible.filter((d) => mine.has(d.id)).map((d) => d.id),
    [visible, mine],
  );

  useEffect(() => {
    if (!user || addedIds.length === 0) {
      setProgress(new Map());
      return;
    }
    let cancelled = false;
    fetchDeckProgress(addedIds, user.id)
      .then((p) => { if (!cancelled) setProgress(p); })
      .catch((err) => console.error('Could not load deck progress:', err));
    return () => { cancelled = true; };
    // addedIds is a fresh array each render; join it so the effect only
    // re-runs when the actual set of ids changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, addedIds.join(',')]);

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

  if (loading || visible.length === 0) return null;

  const deckCard = (deck: Deck) => {
    const added = mine.has(deck.id);
    const foundation = deck.icon === FOUNDATION_ICON && !deck.iconUrl;
    const p = progress.get(deck.id);
    const total = p?.total ?? deck.wordCount ?? 0;
    const learned = added ? (p?.learned ?? 0) : 0;
    const fraction = total > 0 ? learned / total : 0;

    return (
      <button
        key={deck.id}
        onClick={() => add(deck)}
        disabled={busy === deck.id}
        className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 text-start transition-all hover:border-primary/40 hover:shadow-sm"
      >
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          foundation ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-primary'
        }`}>
          <DeckIcon icon={deck.icon} iconUrl={deck.iconUrl} foundation={foundation} size="sm" />
        </span>
        <span className="min-w-0 flex-1 space-y-1.5">
          <span className="block truncate font-semibold text-foreground">{mine.get(deck.id) || deck.title}</span>
          <span className="block text-xs text-muted-foreground">
            {added ? `${learned}/${total} words learned` : `${total} word${total === 1 ? '' : 's'}`}
          </span>
          <span className="block h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary transition-all"
              style={{ width: `${added ? Math.round(fraction * 100) : 0}%` }}
            />
          </span>
        </span>
        {added && (
          <span className="absolute end-3 top-3 flex items-center gap-0.5 rounded-full bg-success px-1.5 py-0.5 text-[9px] font-semibold text-success-foreground">
            <Check className="h-2.5 w-2.5" />
            Added
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="hidden gap-6 lg:grid lg:grid-cols-2">
      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Practice
        </h2>
        <div className="space-y-2.5">
          {PRACTICE_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-start transition-all hover:border-primary/40 hover:shadow-sm"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">{item.label}</span>
                <span className="block text-xs text-muted-foreground">{item.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Vocabulary
        </h2>
        <div className="space-y-2.5">
          {visible.map(deckCard)}
        </div>
      </section>
    </div>
  );
};

export default HomeDesktopColumns;
