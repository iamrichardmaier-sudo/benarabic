import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { HitRow } from '@/components/dictionary/dict-ui';
import { normalizeArabic } from '@/lib/arabic-normalize';
import { loadIndex, refFor, searchIndex, type DictHit } from '@/lib/ref-dictionary';
import WordRow from '@/components/WordRow';
import type { FlashCard } from '@/lib/spaced-repetition';
import { rankDeck } from '@/lib/deck-search';
import { cn } from '@/lib/utils';

interface DeckSearchProps {
  cards: FlashCard[];
  /** Opens the dictionary on the query, to see every match there. */
  onLookUp?: (query: string) => void;
  /** Opens one dictionary entry, by its slug or id. */
  onOpenWord?: (ref: string) => void;
  className?: string;
}

/** Dictionary matches shown under the deck's own. */
const DICT_PREVIEW = 6;

const FIRST_PAGE = 8;
const MORE = 20;

/**
 * Look up any word from the top of Home or Learn, in Arabic (with or without
 * vowels) or English, closest match first: your own cards, each opening in
 * place onto everything the app knows about it, and under them the whole
 * dictionary, about 27,000 words, whether or not they are in the deck.
 */
const DeckSearch = ({ cards, onLookUp, onOpenWord, className }: DeckSearchProps) => {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(FIRST_PAGE);
  const results = useMemo(() => rankDeck(cards, query), [cards, query]);
  const q = query.trim();

  // The dictionary index is fetched the first time anything is typed, not on
  // every visit to Home.
  const [index, setIndex] = useState<DictHit[] | null>(null);
  useEffect(() => {
    if (!q || index || !onOpenWord) return;
    let live = true;
    loadIndex().then((x) => live && setIndex(x)).catch(() => { /* deck results still show */ });
    return () => { live = false; };
  }, [q, index, onOpenWord]);
  const owned = useMemo(() => {
    const keys = new Set<string>();
    for (const c of cards) for (const w of [c.word, c.wordVoweled]) if (w) keys.add(normalizeArabic(w));
    return keys;
  }, [cards]);
  const dictAll = useMemo(() => (index && q ? searchIndex(index, q, 400) : []), [index, q]);
  // Words already in the deck are listed above; the dictionary adds the rest.
  const dictNew = useMemo(() => dictAll.filter((h) => !owned.has(normalizeArabic(h.word))), [dictAll, owned]);

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
          placeholder="Search your words and the dictionary"
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
            <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
              Nothing in your deck matches “{q}”.
            </p>
          )}

          {onOpenWord && dictNew.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="px-1 text-xs text-muted-foreground">
                {dictNew.length >= 400 ? 'Over 400' : dictNew.length} more in the dictionary
              </p>
              <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
                {dictNew.slice(0, DICT_PREVIEW).map((h) => (
                  <HitRow key={h.id} hit={h} owned={false} onOpen={() => onOpenWord(refFor(h))} />
                ))}
              </div>
            </div>
          )}

          {onLookUp && (
            <button
              type="button"
              onClick={() => onLookUp(q)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/40"
            >
              <BookOpen className="h-4 w-4" />
              {dictNew.length > DICT_PREVIEW ? `See all in the dictionary` : 'Open the dictionary'}
            </button>
          )}
        </section>
      )}
    </div>
  );
};

export default DeckSearch;
