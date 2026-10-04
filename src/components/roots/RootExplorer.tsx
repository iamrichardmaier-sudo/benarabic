import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import BackButton from '@/components/BackButton';
import RootDetail from '@/components/roots/RootDetail';
import type { FlashCard } from '@/lib/spaced-repetition';
import { loadRootMeanings } from '@/lib/morphology';
import { filterRoots, meaningFor, summariseRoots } from '@/lib/root-tree';

interface RootExplorerProps {
  cards: FlashCard[];
  onBack: () => void;
  /** Open straight onto one root, e.g. when arriving from a word. */
  initialRoot?: string | null;
}

/**
 * Browse the deck by root instead of by word.
 *
 * Arabic is built on roots, so "everything I know that comes from ك-ت-ب" is a
 * truer shelf than an alphabetical list. The list is the roots the learner
 * holds words on, fullest family first; tapping one opens its tree.
 */
const RootExplorer = ({ cards, onBack, initialRoot = null }: RootExplorerProps) => {
  const [selected, setSelected] = useState<string | null>(initialRoot);
  const [query, setQuery] = useState('');
  const [meanings, setMeanings] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    loadRootMeanings()
      .then((m) => {
        if (!cancelled) setMeanings(m);
      })
      .catch(() => {
        /* a root without its gloss is still a root */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const roots = useMemo(() => summariseRoots(cards), [cards]);
  const shown = useMemo(() => filterRoots(roots, query, meanings), [roots, query, meanings]);
  const rootless = useMemo(() => cards.filter((c) => !c.root).length, [cards]);

  if (selected) {
    return (
      <RootDetail
        root={selected}
        cards={cards}
        meaning={meaningFor(selected, meanings)}
        onBack={() => setSelected(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Learn" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Roots</h1>
        <p className="text-sm text-muted-foreground">
          {roots.length === 0
            ? 'Words with a root will gather here.'
            : `${roots.length} root${roots.length === 1 ? '' : 's'} across your deck. Tap one to see everything built on it.`}
        </p>
      </div>

      {roots.length > 0 && (
        <label className="relative block">
          <span className="sr-only">Search roots</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a root or a meaning"
            className="w-full rounded-xl border border-border bg-background py-2.5 ps-9 pe-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </label>
      )}

      {shown.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {shown.map((r, i) => {
            const meaning = meaningFor(r.root, meanings);
            return (
              <button
                key={r.key}
                onClick={() => setSelected(r.root)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-muted/40 ${
                  i > 0 ? 'border-t border-border' : ''
                }`}
              >
                <span className="font-arabic w-20 shrink-0 text-xl font-bold text-foreground" dir="rtl">
                  {r.root}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">
                    {meaning ?? <span className="text-muted-foreground">No gloss yet</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {r.count} word{r.count === 1 ? '' : 's'}
                    {r.forms.length > 0 && ` · Form ${r.forms.join(', ')}`}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            );
          })}
        </div>
      )}

      {roots.length > 0 && shown.length === 0 && (
        <p className="rounded-xl border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No root matches “{query}”.
        </p>
      )}

      {rootless > 0 && (
        <p className="px-1 text-xs text-muted-foreground">
          {rootless} word{rootless === 1 ? ' has' : 's have'} no root recorded yet, so
          {rootless === 1 ? ' it is' : ' they are'} not listed here.
        </p>
      )}
    </div>
  );
};

export default RootExplorer;
