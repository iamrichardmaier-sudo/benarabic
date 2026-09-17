import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, Search, Send, Trash2, X } from 'lucide-react';
import BackButton from '@/components/BackButton';
import DeckIcon from '@/components/decks/DeckIcon';
import { useAuth } from '@/hooks/useAuth';
import { DECK_ICON_KEYS, nextFreeIcon, type DeckIconKey } from '@/lib/deck-icons';
import {
  createDeck, updateDeck, deleteDeck, fetchDeckWords, searchWords,
  setDeckWords, removeDeckWord, ensureWord, addDecksToLearn,
  type Deck, type Word,
} from '@/lib/deck-store';
import { parseWordLine } from '@/lib/spaced-repetition';

interface DeckBuilderProps {
  onBack: () => void;
  /** Editing an existing deck rather than starting a new one. */
  deck?: Deck | null;
  /** True for the account allowed to publish decks for everyone. */
  admin?: boolean;
  onSaved?: () => void;
}

function reason(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'That did not work.';
}

/**
 * Building a deck.
 *
 * Two ways in, on purpose: most words a learner wants already exist in the
 * shared bank, so the first move is to search for them rather than retype
 * what someone has already tagged. Anything genuinely new is typed straight
 * in, and lands in the shared bank too so the next person finds it.
 *
 * The admin uses this same screen. The only difference is a publish control,
 * which is why it is one component and not two.
 */
const DeckBuilder = ({ onBack, deck = null, admin = false, onSaved }: DeckBuilderProps) => {
  const { user } = useAuth();
  const [saved, setSaved] = useState<Deck | null>(deck);
  const [title, setTitle] = useState(deck?.title ?? '');
  const [icon, setIcon] = useState<DeckIconKey>((deck?.icon as DeckIconKey) ?? 'book');
  const [words, setWords] = useState<Word[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Word[]>([]);
  const [searching, setSearching] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!saved) return;
    fetchDeckWords(saved.id).then(setWords).catch((err) => setError(reason(err)));
  }, [saved]);

  // Pick an icon no other deck of theirs is using, so a shelf of custom decks
  // stays distinguishable without anyone choosing.
  useEffect(() => {
    if (!deck) setIcon(nextFreeIcon([]));
  }, [deck]);

  const held = useMemo(() => new Set(words.map((w) => w.id)), [words]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    // Debounced: the bank is searched on the server, and a request per
    // keystroke would be both slow and rude.
    searchTimer.current = setTimeout(() => {
      searchWords(query)
        .then(setResults)
        .catch((err) => setError(reason(err)))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  /** A deck has to exist before words can go in it. */
  const ensureDeck = async (): Promise<Deck> => {
    if (saved) return saved;
    if (!user) throw new Error('Sign in to build a deck.');
    const made = await createDeck({
      title: title.trim() || 'Untitled deck',
      icon,
      createdBy: user.id,
      isAdminDeck: admin,
    });
    // You built it to learn it, so it goes into your Learn section at once.
    await addDecksToLearn([made.id], user.id);
    setSaved(made);
    return made;
  };

  const addWord = async (word: Word) => {
    setBusy(true);
    setError(null);
    try {
      const target = await ensureDeck();
      await setDeckWords(target.id, [word.id]);
      setWords((prev) => (prev.some((w) => w.id === word.id) ? prev : [...prev, word]));
      if (user) await addDecksToLearn([target.id], user.id);
    } catch (err) {
      setError(reason(err));
    } finally {
      setBusy(false);
    }
  };

  const addTypedWord = async () => {
    const line = newWord.trim();
    if (!line) return;
    setBusy(true);
    setError(null);
    try {
      // The same one-line format the app has always accepted, so muscle
      // memory from the old add-words screen still works here.
      const parsed = parseWordLine(line);
      if (parsed.length === 0) throw new Error('Could not read that line.');
      const target = await ensureDeck();
      const added: Word[] = [];
      for (const entry of parsed) {
        const word = await ensureWord({
          word: entry.fusha,
          wordVoweled: entry.fusha,
          english: entry.english,
          shaami: entry.shaami,
          root: null, wordType: null, verbForm: null,
          pastTense: null, presentTense: null, masdarForm: null,
          gender: null, fushaPlural: null, shaamiPlural: null,
          companionForms: null, exampleSentence: null, exampleSentenceEn: null,
        });
        added.push(word);
      }
      await setDeckWords(target.id, added.map((w) => w.id));
      setWords((prev) => [...prev, ...added.filter((w) => !prev.some((p) => p.id === w.id))]);
      if (user) await addDecksToLearn([target.id], user.id);
      setNewWord('');
      setNote(`Added ${added.length} word${added.length === 1 ? '' : 's'}`);
    } catch (err) {
      setError(reason(err));
    } finally {
      setBusy(false);
    }
  };

  const dropWord = async (wordId: string) => {
    if (!saved) return;
    try {
      await removeDeckWord(saved.id, wordId);
      setWords((prev) => prev.filter((w) => w.id !== wordId));
    } catch (err) {
      setError(reason(err));
    }
  };

  const saveTitle = async () => {
    const target = await ensureDeck();
    await updateDeck(target.id, { title, icon });
    setSaved({ ...target, title: title.trim() || 'Untitled deck', icon });
    setNote('Saved');
    onSaved?.();
  };

  const requestPublic = async () => {
    if (!saved) return;
    await updateDeck(saved.id, { publishRequested: true });
    setSaved({ ...saved, publishRequested: true });
    setNote('Sent for review. It stays private until it is approved.');
  };

  const publish = async () => {
    if (!saved) return;
    await updateDeck(saved.id, { isPublic: true, status: 'published' });
    setSaved({ ...saved, isPublic: true, status: 'published' });
    setNote('Published — everyone can see it in Learn Decks.');
    onSaved?.();
  };

  const unpublish = async () => {
    if (!saved) return;
    await updateDeck(saved.id, { status: 'draft' });
    setSaved({ ...saved, status: 'draft' });
    setNote('Back to draft. It is no longer in the browse list.');
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <BackButton onClick={onBack} label="Decks" />

      <div className="space-y-1">
        <h2 className="text-xl font-bold text-foreground">
          {deck ? 'Edit deck' : 'Build a deck'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Search the shared bank for words, or type in ones that are not there yet.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {note && !error && (
        <p className="rounded-xl border border-border bg-card px-4 py-2.5 text-center text-xs text-muted-foreground">
          {note}
        </p>
      )}

      <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <DeckIcon icon={icon} />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && saveTitle()}
            placeholder="Deck name"
            aria-label="Deck name"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DECK_ICON_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setIcon(key)}
              aria-label={`Use the ${key} icon`}
              aria-pressed={icon === key}
              className={`rounded-lg border p-1.5 transition-colors ${
                icon === key ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/40'
              }`}
            >
              <DeckIcon icon={key} size="sm" className="border-0 bg-transparent" />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 rounded-2xl border border-border bg-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search every word in the database"
            aria-label="Search the shared word bank"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {results.length > 0 && (
          <div className="max-h-64 overflow-y-auto rounded-xl border border-border divide-y divide-border/60">
            {results.map((w) => (
              <button
                key={w.id}
                onClick={() => addWord(w)}
                disabled={held.has(w.id) || busy}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start transition-colors hover:bg-muted/40 disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-muted-foreground">
                    {w.english ?? '—'}
                  </span>
                  {w.root && (
                    <span className="block font-arabic text-[11px] text-muted-foreground/80" dir="rtl">
                      {w.root}
                    </span>
                  )}
                </span>
                <span className="font-arabic text-base text-foreground" dir="rtl">
                  {w.wordVoweled || w.word}
                </span>
                {held.has(w.id) ? (
                  <Check className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Plus className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-1 border-t border-border/60 pt-3">
          <label htmlFor="new-word" className="text-xs font-medium text-foreground">
            Not in the database? Type it in
          </label>
          <div className="flex gap-2">
            <input
              id="new-word"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTypedWord();
                }
              }}
              placeholder="فِطِر / فَطَرَ | to eat breakfast"
              dir="rtl"
              className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 font-arabic text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={addTypedWord}
              disabled={!newWord.trim() || busy}
              className="shrink-0 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Fusha / Shaami | English. It goes into the shared bank too, so others can find it.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
        <p className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          In this deck · {words.length}
        </p>
        {words.map((w) => (
          <div key={w.id} className="flex items-center gap-2 px-3">
            <span className="min-w-0 flex-1 truncate py-2.5 text-xs text-muted-foreground">
              {w.english ?? '—'}
            </span>
            <span className="font-arabic text-base text-foreground" dir="rtl">
              {w.wordVoweled || w.word}
            </span>
            <button
              onClick={() => dropWord(w.id)}
              aria-label={`Remove ${w.word}`}
              className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {words.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing in it yet. Search above, or type a word in.
          </p>
        )}
      </div>

      {saved && (
        <div className="space-y-2">
          {admin ? (
            <>
              {saved.status === 'draft' ? (
                <button
                  onClick={publish}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-all active:scale-95"
                >
                  <Send className="h-4 w-4" />
                  Publish as a public deck
                </button>
              ) : (
                <button
                  onClick={unpublish}
                  className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground"
                >
                  Unpublish — back to draft
                </button>
              )}
            </>
          ) : (
            !saved.publishRequested && (
              <button
                onClick={requestPublic}
                className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-foreground"
              >
                Ask for this deck to be shared
              </button>
            )
          )}

          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full text-xs text-muted-foreground underline hover:text-destructive"
            >
              Delete this deck
            </button>
          ) : (
            <div className="space-y-2 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium text-foreground">Delete {saved.title}?</p>
              <p className="text-xs text-muted-foreground">
                The deck goes. The words stay in the shared bank and your cards keep their
                progress — only this grouping is removed.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl border border-border py-2 text-sm font-semibold"
                >
                  Keep it
                </button>
                <button
                  onClick={async () => {
                    await deleteDeck(saved.id);
                    onSaved?.();
                    onBack();
                  }}
                  className="rounded-xl bg-destructive py-2 text-sm font-semibold text-destructive-foreground"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeckBuilder;
