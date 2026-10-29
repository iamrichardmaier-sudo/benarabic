import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import BackButton from '@/components/BackButton';
import type { NewWord } from '@/contexts/DeckActionsContext';
import type { FlashCard } from '@/lib/spaced-repetition';
import { findHit, loadIndex, loadRoot, refFor, type DictEntry, type DictHit, type Family } from '@/lib/ref-dictionary';
import { useDeckKeys } from '@/lib/ref-dictionary-cards';
import DictionarySearch from './DictionarySearch';
import DictionaryEntryView from './DictionaryEntryView';
import FamilyView from './FamilyView';

interface Props {
  /** "" for search, "<slug or id>" for a word, "root/<root>" for a root. */
  path: string;
  onPathChange: (path: string) => void;
  deck: FlashCard[];
  onAdd?: (word: NewWord) => Promise<void>;
  onBack: () => void;
  /** A search carried in from elsewhere (Home, Learn). */
  initialQuery?: string;
  onSearchBible?: () => void;
  /** Add the open word as soon as it loads (from a public page's Add button). */
  autoAdd?: boolean;
  onAutoAdded?: () => void;
}

/**
 * The dictionary inside the app: every entry of the reference dictionary,
 * about 27,000 words, searchable in Arabic, transliteration or English, each
 * opening onto its meanings, forms, root family and conjugation, and one tap
 * from the deck.
 */
const DictionaryScreen = ({
  path, onPathChange, deck, onAdd, onBack, initialQuery, onSearchBible, autoAdd, onAutoAdded,
}: Props) => {
  const [index, setIndex] = useState<DictHit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const deckKeys = useDeckKeys(deck);

  useEffect(() => {
    let live = true;
    loadIndex().then((x) => live && setIndex(x)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, []);

  const byId = useMemo(() => new Map((index ?? []).map((h) => [h.id, h])), [index]);
  const open = (h: DictHit) => onPathChange(refFor(h));
  const openRoot = (root: string) => onPathChange(`root/${root}`);

  const isRoot = path.startsWith('root/');
  const root = isRoot ? path.slice(5) : '';
  const hit = index && path && !isRoot ? findHit(index, path) : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <BackButton onClick={path ? () => onPathChange('') : onBack} label={path ? 'Dictionary' : 'Learn'} />
        {!path && (
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-foreground">Dictionary</h1>
            <p className="text-sm text-muted-foreground">
              Every word with its meanings, plurals, conjugations and root family.
            </p>
          </div>
        )}
      </div>

      {failed && (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          The dictionary could not be loaded. Check your connection and try again.
        </p>
      )}
      {!index && !failed && (
        <div className="flex justify-center py-16 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      )}

      {index && !path && (
        <DictionarySearch index={index} deckKeys={deckKeys} initialQuery={initialQuery} onOpen={open} onSearchBible={onSearchBible} />
      )}
      {index && hit && (
        <DictionaryEntryView
          key={hit.id}
          hit={hit}
          byId={byId}
          deckKeys={deckKeys}
          onAdd={onAdd}
          onOpen={open}
          onOpenRoot={openRoot}
          autoAdd={autoAdd}
          onAutoAdded={onAutoAdded}
        />
      )}
      {index && path && !isRoot && !hit && (
        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          That word is not in the dictionary.
        </p>
      )}
      {index && isRoot && (
        <RootView key={root} root={root} index={index} byId={byId} deckKeys={deckKeys} onOpen={open} />
      )}
    </div>
  );
};

function RootView({
  root, index, byId, deckKeys, onOpen,
}: { root: string; index: DictHit[]; byId: Map<number, DictHit>; deckKeys: Set<string>; onOpen: (h: DictHit) => void }) {
  const [data, setData] = useState<{ family: Family | null; members: Map<number, DictEntry> } | null>(null);
  useEffect(() => {
    let live = true;
    loadRoot(root, index).then((d) => live && setData(d)).catch(() => live && setData({ family: null, members: new Map() }));
    return () => { live = false; };
  }, [root, index]);
  const count = data ? data.members.size : 0;
  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 rounded-3xl border border-border bg-card px-6 py-7 flashcard-shadow sm:px-8">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Root</p>
          <p className="text-sm text-muted-foreground">
            {data ? `${count} word${count === 1 ? '' : 's'} in the dictionary` : '\u00a0'}
          </p>
        </div>
        <h1 className="font-card text-5xl font-bold leading-[1.5] text-foreground" dir="rtl" lang="ar">{root}</h1>
      </header>
      {!data && <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
      {data?.family ? (
        <FamilyView family={data.family} members={data.members} byId={byId} deckKeys={deckKeys} onOpen={onOpen} />
      ) : data && (
        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          The dictionary has no words on this root.
        </p>
      )}
    </div>
  );
}

export default DictionaryScreen;
