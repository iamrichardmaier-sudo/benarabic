import { useState } from 'react';
import { Check, Loader2, Plus } from 'lucide-react';
import { useDeckActions, type NewWord } from '@/contexts/DeckActionsContext';
import { setReaderStatus } from '@/lib/preferences';
import { STATUS_UNDERLINE, type Coverage, type WordStatus } from '@/lib/reader-status';

interface ReaderKnowledgeProps {
  /** Whether words are being marked. */
  on: boolean;
  /** How the text's words split; null while it is still loading. */
  coverage: Coverage | null;
  /** New words on roots the deck already holds, ready to be added. */
  rootWords: NewWord[];
  /** "chapter", "article": what the percentage is of. */
  noun: string;
}

/** Adding more than this at once is a pile to learn, not a pickup. */
const MAX_ADD = 20;

const KEY: { status: Exclude<WordStatus, 'none' | 'known'>; label: string }[] = [
  { status: 'learning', label: 'learning' },
  { status: 'root', label: 'new, root you know' },
  { status: 'new', label: 'new' },
];

/**
 * The strip above a text that says how much of it the learner can already
 * read, explains the marks under the words, and offers the cheapest new words
 * on the page: the ones built on roots they already hold.
 */
const ReaderKnowledge = ({ on, coverage, rootWords, noun }: ReaderKnowledgeProps) => {
  const { addWords } = useDeckActions();
  const [state, setState] = useState<'idle' | 'saving' | 'done'>('idle');
  const [added, setAdded] = useState(0);

  const batch = rootWords.slice(0, MAX_ADD);
  const addAll = async () => {
    if (!addWords || state === 'saving') return;
    setState('saving');
    try {
      setAdded(await addWords(batch));
      setState('done');
    } catch {
      setState('idle');
    }
  };

  const percent = coverage?.share != null ? Math.round(coverage.share * 100) : null;

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 space-y-2" dir="ltr">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          {!on ? (
            <span className="text-muted-foreground">Mark the words I know</span>
          ) : percent === null ? (
            <span className="text-muted-foreground">Working out what you know…</span>
          ) : (
            <>
              You know <span className="font-bold tabular-nums">{percent}%</span> of this {noun}
              <span className="text-muted-foreground"> · {coverage!.root + coverage!.new} new</span>
            </>
          )}
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Mark the words I know"
          onClick={() => setReaderStatus(!on)}
          className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-muted'}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-all ${on ? 'start-[18px]' : 'start-0.5'}`}
          />
        </button>
      </div>

      {on && coverage && coverage.counted > 0 && (
        <>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>no mark: known</span>
            {KEY.map((k) => (
              <span key={k.status} className="inline-flex items-center gap-1.5">
                <span className={`underline underline-offset-[5px] ${STATUS_UNDERLINE[k.status]}`}>
                  &nbsp;&nbsp;&nbsp;&nbsp;
                </span>
                {k.label} <span className="tabular-nums">({coverage[k.status]})</span>
              </span>
            ))}
          </p>

          {addWords && batch.length > 0 && (
            state === 'done' ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                <Check className="h-3.5 w-3.5" />
                {added === 0 ? 'Those were already in your cards' : `Added ${added} — waiting in Learn`}
              </p>
            ) : (
              <button
                type="button"
                onClick={addAll}
                disabled={state === 'saving'}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-semibold text-primary-foreground transition-all active:scale-[0.99] disabled:opacity-60"
              >
                {state === 'saving' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add {batch.length} new word{batch.length === 1 ? '' : 's'} on roots you know
                {rootWords.length > MAX_ADD ? ` (of ${rootWords.length})` : ''}
              </button>
            )
          )}
        </>
      )}
    </div>
  );
};

export default ReaderKnowledge;
