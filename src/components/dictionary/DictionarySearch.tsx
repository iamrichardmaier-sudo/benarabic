import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Search, X } from 'lucide-react';
import { normalizeArabic } from '@/lib/arabic-normalize';
import { recentSearches, searchIndex, type DictHit } from '@/lib/ref-dictionary';
import { HitRow, Panel } from './dict-ui';

interface Props {
  index: DictHit[];
  deckKeys: Set<string>;
  initialQuery?: string;
  onOpen: (hit: DictHit) => void;
  /** Opens the search of the tagged Bible, for a word as it is used there. */
  onSearchBible?: () => void;
}

const PAGE = 30;

/**
 * The dictionary's front page: one field, results as you type, and before
 * anything is typed, the words looked up lately and the most common words.
 */
const DictionarySearch = ({ index, deckKeys, initialQuery = '', onOpen, onSearchBible }: Props) => {
  const [query, setQuery] = useState(initialQuery);
  const [limit, setLimit] = useState(PAGE);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // Straight to typing on a phone and a laptop alike, unless a query came with us.
    if (!initialQuery) input.current?.focus();
  }, [initialQuery]);

  const results = useMemo(() => searchIndex(index, query, 400), [index, query]);
  const recent = useMemo(() => {
    const byId = new Map(index.map((h) => [h.id, h]));
    return recentSearches().map((id) => byId.get(id)).filter((h): h is DictHit => !!h);
  }, [index]);
  const common = useMemo(() => index.filter((h) => h.slug).slice(0, 24), [index]);
  const owned = (h: DictHit) => deckKeys.has(normalizeArabic(h.word));
  const q = query.trim();

  return (
    <div className="space-y-6">
      <label className="relative block">
        <span className="sr-only">Search the dictionary</span>
        <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setQuery('');
            if (e.key === 'Enter' && results[0]) onOpen(results[0]);
          }}
          placeholder="كتاب, book, kitab …"
          className="w-full rounded-2xl border border-border bg-card py-4 ps-12 pe-12 text-base shadow-sm transition-shadow placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); input.current?.focus(); }}
            aria-label="Clear search"
            className="absolute end-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      {q ? (
        results.length > 0 ? (
          <div className="space-y-2">
            <p className="px-1 text-xs text-muted-foreground" aria-live="polite">
              {results.length >= 400 ? 'Over 400' : results.length} match{results.length === 1 ? '' : 'es'}
            </p>
            <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border bg-card">
              {results.slice(0, limit).map((h) => (
                <HitRow key={h.id} hit={h} owned={owned(h)} onOpen={() => onOpen(h)} />
              ))}
            </div>
            {results.length > limit && (
              <button
                type="button"
                onClick={() => setLimit((n) => n + PAGE)}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted/40"
              >
                Show more
              </button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center">
            <p className="font-medium text-foreground">No word matches “{q}”</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try it without vowels, by its root (كتب), or by its meaning in English.
            </p>
          </div>
        )
      ) : (
        <>
          {recent.length > 0 && (
            <Panel title="Looked up lately">
              <div className="flex flex-wrap gap-2 p-3">
                {recent.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => onOpen(h)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 transition-colors hover:border-primary/50"
                  >
                    <span className="font-card text-lg leading-none" dir="rtl" lang="ar">{h.word}</span>
                    <span className="ms-2 text-xs text-muted-foreground">{h.gloss}</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}
          <section className="space-y-2">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Most common words</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {common.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => onOpen(h)}
                  className="flex flex-col items-start rounded-2xl border border-border bg-card px-4 py-3 text-start transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  <span className="font-card text-2xl leading-relaxed text-foreground" dir="rtl" lang="ar">{h.word}</span>
                  <span className="w-full truncate text-xs text-muted-foreground">{h.gloss}</span>
                </button>
              ))}
            </div>
          </section>
          {onSearchBible && (
            <button
              type="button"
              onClick={onSearchBible}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-start transition-colors hover:border-primary/40"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-foreground">Search the Bible</span>
                <span className="block truncate text-xs text-muted-foreground">Find a word as it is used in the tagged Bible, and add it from there</span>
              </span>
            </button>
          )}
          <p className="px-1 text-center text-xs text-muted-foreground">
            {index.length.toLocaleString()} words, adapted from Wiktionary (CC BY-SA 4.0).
          </p>
        </>
      )}
    </div>
  );
};

export default DictionarySearch;
