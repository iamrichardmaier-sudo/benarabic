import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Check, Loader2 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import SpeakButton from '@/components/SpeakButton';
import { searchDictionary, entryToCardFields, type DictionaryEntry } from '@/lib/dictionary';
import { wordKey } from '@/lib/word-relations';
import type { FlashCard } from '@/lib/spaced-repetition';

interface WordLookupProps {
  /** The learner's deck, for marking words they already have. */
  deck: FlashCard[];
  onAdd: (entry: DictionaryEntry) => Promise<void>;
  onBack: () => void;
}

const POS_LABELS: Record<string, string> = {
  verb: 'Verb',
  noun: 'Noun',
  adjective: 'Adjective',
  participle: 'Participle',
  proper_noun: 'Name',
  particle: 'Particle',
};

/**
 * Look a word up in the shared dictionary and add it to your deck.
 *
 * The dictionary is every distinct word the tagged Bible corpus knows —
 * roughly three thousand entries, collapsed from their inflected forms to one
 * per lemma, each carrying a root, a form and the senses it was actually
 * glossed with in running text.
 */
const WordLookup = ({ deck, onAdd, onBack }: WordLookupProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionaryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  // Every word already in the deck, keyed on its consonant skeleton, so an
  // entry the learner has under a different spelling still reads as owned.
  const owned = useMemo(() => {
    const keys = new Set<string>();
    for (const card of deck) {
      keys.add(wordKey(card.word));
      if (card.wordVoweled) keys.add(wordKey(card.wordVoweled));
    }
    keys.delete('');
    return keys;
  }, [deck]);

  // Debounced, and guarded against out-of-order responses: a slow request for
  // an earlier query must not overwrite the results of a later one.
  const latest = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setFailed(false);
      return;
    }
    setSearching(true);
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      searchDictionary(q)
        .then((rows) => {
          if (ticket !== latest.current) return;
          setResults(rows);
          setFailed(false);
        })
        .catch(() => {
          if (ticket !== latest.current) return;
          setResults([]);
          setFailed(true);
        })
        .finally(() => {
          if (ticket === latest.current) setSearching(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAdd = async (entry: DictionaryEntry) => {
    setAdding(entry.id);
    try {
      await onAdd(entry);
      setAdded((prev) => new Set(prev).add(entry.id));
    } finally {
      setAdding(null);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <BackButton onClick={onBack} label="Learn" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Look up a word</h1>
        <p className="text-sm text-muted-foreground">
          Search every word in the tagged Bible, in English or Arabic, and add it to your deck.
        </p>
      </div>

      <div className="sticky top-0 z-10 -mx-1 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. born, or وَلَد"
            aria-label="Search the dictionary"
            className="w-full rounded-full border border-border bg-card py-2 ps-9 pe-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {searching && (
        <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </p>
      )}

      {failed && !searching && (
        <p className="py-6 text-center text-sm text-destructive">
          Could not reach the dictionary. Check your connection and try again.
        </p>
      )}

      {!searching && !failed && query.trim().length >= 2 && results.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing found for “{query.trim()}”.
        </p>
      )}

      <div className="space-y-2">
        {results.map((entry) => {
          const isOwned = owned.has(wordKey(entry.lemma)) || added.has(entry.id);
          const subtitle = [
            entry.pos ? POS_LABELS[entry.pos] ?? entry.pos : null,
            entry.verbForm ? `Form ${entry.verbForm}` : null,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={entry.id}
              className="rounded-xl border border-border/50 bg-card p-4 flashcard-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-arabic text-xl font-bold text-foreground" dir="rtl">
                      {entry.lemma}
                    </p>
                    <SpeakButton word={entry.lemma} size={16} />
                  </div>

                  {subtitle && <p className="text-xs font-medium text-primary">{subtitle}</p>}

                  <p className="mt-1 text-sm text-muted-foreground">{entry.glosses.join('; ')}</p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {entry.root && (
                      <span className="flex items-center gap-1.5">
                        Root
                        <span className="font-arabic text-[13px] font-semibold text-primary" dir="rtl">
                          {entry.root}
                        </span>
                      </span>
                    )}
                    <span>
                      {entry.occurrences} time{entry.occurrences === 1 ? '' : 's'} in the Bible
                    </span>
                  </div>
                </div>

                {isOwned ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-success">
                    <Check className="h-4 w-4" />
                    In deck
                  </span>
                ) : (
                  <button
                    onClick={() => handleAdd(entry)}
                    disabled={adding === entry.id}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                  >
                    {adding === entry.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Add
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WordLookup;
