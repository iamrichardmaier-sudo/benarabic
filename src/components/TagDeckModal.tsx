import { useEffect, useRef, useState } from 'react';
import { X, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  countUntaggedCards,
  retagEntireDeck,
  tagUntaggedDeck,
  type AutoTagSummary,
} from '@/lib/auto-tag-deck';

interface TagDeckModalProps {
  totalCards: number;
  onClose: () => void;
  /** Called after tagging finishes so the deck can refresh from the DB. */
  onDone: () => void;
}

type Phase = 'choose' | 'running' | 'done' | 'error';

const TagDeckModal = ({ totalCards, onClose, onDone }: TagDeckModalProps) => {
  const [phase, setPhase] = useState<Phase>('choose');
  const [untaggedCount, setUntaggedCount] = useState<number | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<AutoTagSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const cancelled = useRef(false);

  useEffect(() => {
    countUntaggedCards()
      .then(setUntaggedCount)
      .catch(() => setUntaggedCount(null));
  }, []);

  useEffect(() => {
    return () => {
      cancelled.current = true;
    };
  }, []);

  const run = async (mode: 'untagged' | 'all') => {
    setPhase('running');
    setProgress({ done: 0, total: mode === 'all' ? totalCards : untaggedCount ?? 0 });
    try {
      const onProgress = (done: number, total: number) => {
        if (!cancelled.current) setProgress({ done, total });
      };
      const result =
        mode === 'all' ? await retagEntireDeck(onProgress) : await tagUntaggedDeck(onProgress);
      if (cancelled.current) return;
      setSummary(result);
      setPhase('done');
      onDone();
    } catch (err) {
      if (cancelled.current) return;
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong while tagging.');
      setPhase('error');
    }
  };

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const closable = phase !== 'running';

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card flashcard-shadow border border-border/60 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Tag Words</h2>
          </div>
          <button
            onClick={onClose}
            disabled={!closable}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {phase === 'choose' && (
            <>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Auto-tagging fills in each word's root, grammatical identity, voweled forms, and
                companion words using Claude. Pick which cards to process.
              </p>

              <div className="space-y-2">
                <button
                  onClick={() => run('untagged')}
                  disabled={untaggedCount === 0}
                  className="w-full flex items-center justify-between gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-3 font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  <span>Tag untagged words</span>
                  <span className="text-sm font-normal opacity-90">
                    {untaggedCount === null ? '…' : untaggedCount}
                  </span>
                </button>
                <button
                  onClick={() => run('all')}
                  className="w-full flex items-center justify-between gap-2 rounded-xl bg-secondary text-secondary-foreground px-4 py-3 font-semibold transition-all active:scale-95"
                >
                  <span>Re-tag everything</span>
                  <span className="text-sm font-normal opacity-90">{totalCards}</span>
                </button>
              </div>

              <p className="text-xs text-muted-foreground/80 leading-relaxed">
                Re-tagging every word runs a fresh AI pass over your whole deck and overwrites the
                existing tags. This can take a few minutes and uses your Anthropic API credits.
              </p>
            </>
          )}

          {phase === 'running' && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-foreground text-center font-medium">
                Tagging {progress.done} of {progress.total}…
              </p>
              <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Keep this screen open until it finishes.
              </p>
            </div>
          )}

          {phase === 'done' && summary && (
            <div className="space-y-4 py-2 text-center">
              <CheckCircle2 className="w-10 h-10 text-success mx-auto" />
              <div>
                <p className="text-base font-semibold text-foreground">
                  Tagged {summary.tagged} word{summary.tagged !== 1 ? 's' : ''}
                </p>
                {summary.failed > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {summary.failed} couldn't be tagged — try again to retry those.
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
              >
                Done
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="space-y-4 py-2 text-center">
              <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
              <div>
                <p className="text-base font-semibold text-foreground">Tagging failed</p>
                <p className="text-sm text-muted-foreground mt-1 break-words">{errorMsg}</p>
              </div>
              <button
                onClick={() => setPhase('choose')}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TagDeckModal;
