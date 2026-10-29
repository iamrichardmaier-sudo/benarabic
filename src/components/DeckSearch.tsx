import { useMemo, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import WordRow from '@/components/WordRow';
import type { FlashCard } from '@/lib/spaced-repetition';
import { rankDeck } from '@/lib/deck-search';
import { cn } from '@/lib/utils';

interface DeckSearchProps {
  cards: FlashCard[];
  /** Opens the dictionary on the query, offered when the deck has no match. */
  onLookUp?: (query: string) => void;
  className?: string;
}

const FIRST_PAGE = 8;
const MORE = 20;

/**
 * Look up any word in the deck from the top of Home or Learn, in Arabic
 * (with or without vowels) or English, closest match first. Each result opens
 * in place onto everything the app knows about the word.
 */
const DeckSearch = ({ cards, onLookUp, className }: DeckSearchProps) => {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(FIRST_PAGE);
  const results = useMemo(() => rankDeck(cards, query), [cards, query]);
  const q = query.trim();

  const change = (value: string) => {
    setQuery(value);
    setLimit(FIRST_PAGE);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <label className="relative block">
        <span className="sr-only">Search your words</span>
        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') change(''); }}
          placeholder="Search your words — Arabic or English"
          className="w-full rounded-2xl border border-border bg-card py-3 ps-10 pe-10 text-sm shadow-sm transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => change('')}
            aria-label="Clear search"
            className="absolute end-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      {q && (
        <section aria-label="Search results" className="space-y-2">
          {results.length > 0 ? (
            <>
              <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
                {results.length} match{results.length === 1 ? '' : 'es'} in your deck
              </p>
              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                {results.slice(0, limit).map((c) => (
                  <WordRow
                    key={c.id}
                    card={c}
                    deck={cards}
                    note={[c.root, c.verbForm && `Form ${c.verbForm}`].filter(Boolean).join(' · ') || undefined}
                  />
                ))}
              </div>
              {results.length > limit && (
                <button
                  type="button"
                  onClick={() => setLimit((n) => n + MORE)}
                  className="w-full rounded-xl border border-border py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
                >
                  Show {Math.min(MORE, results.length - limit)} more
                </button>
              )}
            </>
          ) : (
            <div className="space-y-2 rounded-2xl border border-border bg-card px-4 py-5 text-center">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Nothing in your deck matches “{q}”.
              </p>
              {onLookUp && (
                <button
                  type="button"
                  onClick={() => onLookUp(q)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-all active:scale-95"
                >
                  <BookOpen className="h-4 w-4" />
                  Look it up in the dictionary
                </button>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default DeckSearch;
