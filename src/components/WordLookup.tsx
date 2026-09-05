import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Check, Loader2, Sparkles, BookOpen, Bookmark } from 'lucide-react';
import BackButton from '@/components/BackButton';
import SpeakButton from '@/components/SpeakButton';
import {
  searchDictionary, entriesForRoots, entryToCardFields, type DictionaryEntry,
} from '@/lib/dictionary';
import { searchDeck } from '@/lib/deck-search';
import { mergeResults, markOwned, recentRoots, type LookupResult } from '@/lib/lookup';
import { wordKey } from '@/lib/word-relations';
import type { FlashCard } from '@/lib/spaced-repetition';

interface WordLookupProps {
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

/** How many words to suggest under each root the learner already knows. */
const PER_ROOT = 3;
const SUGGESTED_ROOTS = 4;

interface SuggestionGroup {
  root: string;
  /** A word the learner already has on this root, to explain the suggestion. */
  because: string;
  entries: DictionaryEntry[];
}

function WordRow({
  result, onAdd, adding,
}: {
  result: LookupResult;
  onAdd?: () => void;
  adding: boolean;
}) {
  const subtitle = [
    result.pos ? POS_LABELS[result.pos] ?? result.pos : null,
    result.verbForm ? `Form ${result.verbForm}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-xl border border-border/50 bg-card p-3.5 flashcard-shadow">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-arabic text-xl font-bold text-foreground" dir="rtl">
              {result.lemma}
            </p>
            <SpeakButton word={result.lemma} size={16} />
          </div>

          {subtitle && <p className="text-xs font-medium text-primary">{subtitle}</p>}

          {result.glosses.length > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">{result.glosses.join('; ')}</p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {result.root && (
              <span className="flex items-center gap-1.5">
                Root
                <span className="font-arabic text-[13px] font-semibold text-primary" dir="rtl">
                  {result.root}
                </span>
              </span>
            )}
            {result.sources.includes('deck') && (
              <span className="flex items-center gap-1">
                <Bookmark className="h-3 w-3" />
                Your deck
              </span>
            )}
            {result.sources.includes('corpus') && result.occurrences !== null && (
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                {result.occurrences}× {result.attestedIn}
              </span>
            )}
          </div>
        </div>

        {result.inDeck ? (
          <span className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-success">
            <Check className="h-4 w-4" />
            In deck
          </span>
        ) : (
          onAdd && (
            <button
              onClick={onAdd}
              disabled={adding}
              className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add
            </button>
          )
        )}
      </div>
    </div>
  );
}

/**
 * Look a word up across everything the app knows, and add it to the deck.
 *
 * Two sources today — the learner's own cards, searched in memory, and the
 * shared dictionary built from the tagged scriptures — merged into one list rather
 * than presented as two. Words published by other learners would be a third
 * source and would need no change here.
 *
 * Before anything is typed the screen suggests words built on roots the
 * learner already has cards for, so it opens with something to read instead
 * of an empty box.
 */
const WordLookup = ({ deck, onAdd, onBack }: WordLookupProps) => {
  const [query, setQuery] = useState('');
  const [dictMatches, setDictMatches] = useState<DictionaryEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<FlashCard[]>([]);
  const [groups, setGroups] = useState<SuggestionGroup[] | null>(null);

  // Cards added during this visit count as owned straight away, without
  // waiting for the deck prop to come back around from the server.
  const effectiveDeck = useMemo(() => [...deck, ...added], [deck, added]);

  const trimmed = query.trim();
  const active = trimmed.length >= 2;

  // Suggestions: words on the roots this learner has been adding lately,
  // minus the ones they already have.
  useEffect(() => {
    const roots = recentRoots(deck, SUGGESTED_ROOTS * 2);
    if (roots.length === 0) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    entriesForRoots(roots).then((entries) => {
      if (cancelled) return;
      const owned = new Set<string>();
      const example = new Map<string, string>();
      for (const card of deck) {
        const key = wordKey(card.wordVoweled || card.word);
        owned.add(key);
        owned.add(wordKey(card.word));
        if (card.root && !example.has(card.root)) {
          example.set(card.root, card.wordVoweled || card.word);
        }
      }

      const byRoot = new Map<string, DictionaryEntry[]>();
      for (const entry of entries) {
        if (!entry.root || owned.has(wordKey(entry.lemma))) continue;
        const list = byRoot.get(entry.root) ?? [];
        if (list.length >= PER_ROOT) continue;
        list.push(entry);
        byRoot.set(entry.root, list);
      }

      setGroups(
        roots
          .filter((root) => (byRoot.get(root)?.length ?? 0) > 0)
          .slice(0, SUGGESTED_ROOTS)
          .map((root) => ({
            root,
            because: example.get(root) ?? '',
            entries: byRoot.get(root) as DictionaryEntry[],
          })),
      );
    });
    return () => {
      cancelled = true;
    };
    // Recomputed only when the deck itself changes, not on every keystroke.
  }, [deck]);

  // Debounced, and guarded by a ticket so a slow response for an earlier
  // query cannot overwrite the results of a later one.
  const latest = useRef(0);
  useEffect(() => {
    if (!active) {
      setDictMatches([]);
      setSearching(false);
      setFailed(false);
      return;
    }
    setSearching(true);
    const ticket = ++latest.current;
    const timer = setTimeout(() => {
      searchDictionary(trimmed)
        .then((rows) => {
          if (ticket !== latest.current) return;
          setDictMatches(rows);
          setFailed(false);
        })
        .catch(() => {
          if (ticket !== latest.current) return;
          setDictMatches([]);
          setFailed(true);
        })
        .finally(() => {
          if (ticket === latest.current) setSearching(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [trimmed, active]);

  // The deck is searched in memory, so its matches are on screen immediately
  // and the corpus results fill in underneath when the request lands.
  const results = useMemo(() => {
    if (!active) return [];
    return markOwned(mergeResults(searchDeck(effectiveDeck, trimmed), dictMatches), effectiveDeck);
  }, [active, trimmed, effectiveDeck, dictMatches]);

  const handleAdd = async (entry: DictionaryEntry) => {
    setAdding(entry.id);
    try {
      await onAdd(entry);
      const fields = entryToCardFields(entry);
      setAdded((prev) => [...prev, { ...fields, id: `pending:${entry.id}` } as FlashCard]);
    } finally {
      setAdding(null);
    }
  };

  const suggesting = groups === null;

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <BackButton onClick={onBack} label="Learn" />

      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Look up a word</h1>
        <p className="text-sm text-muted-foreground">
          Searches your own deck and every word tagged in the Bible and the Book of Mormon,
          in English or Arabic.
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
            aria-label="Search for a word"
            className="w-full rounded-full border border-border bg-card py-2.5 ps-9 pe-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Before anything is typed */}
      {!active && (
        <div className="space-y-5">
          {suggesting && (
            <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Finding words for you…
            </p>
          )}

          {groups?.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Search for a word in English or Arabic to get started.
            </p>
          )}

          {groups?.map((group) => (
            <section key={group.root} className="space-y-2">
              <h2 className="flex flex-wrap items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Because you know
                <span className="font-arabic text-sm text-foreground" dir="rtl">
                  {group.because}
                </span>
                <span className="text-muted-foreground/60">·</span>
                <span className="font-arabic text-sm font-semibold text-primary" dir="rtl">
                  {group.root}
                </span>
              </h2>
              <div className="space-y-2">
                {group.entries.map((entry) => (
                  <WordRow
                    key={entry.id}
                    result={markOwned(mergeResults([], [entry]), effectiveDeck)[0]}
                    onAdd={() => handleAdd(entry)}
                    adding={adding === entry.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Searching */}
      {active && (
        <div className="space-y-2">
          {results.map((result) => {
            const entry = dictMatches.find((e) => `dict:${e.id}` === result.id);
            return (
              <WordRow
                key={result.id}
                result={result}
                onAdd={entry ? () => handleAdd(entry) : undefined}
                adding={!!entry && adding === entry.id}
              />
            );
          })}

          {searching && (
            <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching the dictionary…
            </p>
          )}

          {failed && !searching && (
            <p className="py-4 text-center text-sm text-destructive">
              Could not reach the dictionary. Your own deck is still searched above.
            </p>
          )}

          {!searching && !failed && results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing found for “{trimmed}”.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default WordLookup;
