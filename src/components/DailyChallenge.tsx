import { useEffect, useState } from 'react';
import { Check, ChevronRight, Languages } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { todayProgress, type DayProgress } from '@/lib/translation-practice';

interface DailyChallengePromptProps {
  open: boolean;
  onStart: () => void;
  onLater: () => void;
}

/** Shown on the first visit of each day: today's three sentences are waiting. */
export const DailyChallengePrompt = ({ open, onStart, onLater }: DailyChallengePromptProps) => (
  <Dialog open={open} onOpenChange={(o) => !o && onLater()}>
    <DialogContent className="max-w-sm">
      <DialogHeader className="items-center text-center">
        <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Languages className="h-6 w-6" />
        </span>
        <DialogTitle className="text-xl">Today’s translation challenge</DialogTitle>
        <DialogDescription>
          Three hard sentences built from your newest words. Write them in Arabic by hand, read them aloud, and
          get feedback word by word.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
        <Button className="w-full" onClick={onStart}>Start the challenge</Button>
        <Button className="w-full" variant="ghost" onClick={onLater}>Later</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

/**
 * Home's card for the day's challenge, near the top so a "Later" on the
 * prompt is never lost. It says how many of the three are done, and stays,
 * ticked, once all three are.
 */
export const DailyChallengeCard = ({ onOpen }: { onOpen: () => void }) => {
  const [progress, setProgress] = useState<DayProgress | null>(null);

  useEffect(() => {
    let live = true;
    todayProgress()
      .then((p) => { if (live) setProgress(p); })
      // Unreadable progress still leaves the card, as "waiting".
      .catch(() => { if (live) setProgress({ ready: false, done: 0, total: 3 }); });
    return () => { live = false; };
  }, []);

  const total = progress?.total ?? 3;
  const done = progress?.done ?? 0;
  const finished = progress !== null && done >= total;
  const detail = progress === null
    ? 'Three sentences from your newest words'
    : finished
      ? 'All three translated today. Come back tomorrow for more'
      : done > 0
        ? `${done} of ${total} translated`
        : 'Three sentences from your newest words are waiting';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-center gap-3 rounded-2xl border p-4 text-start transition-colors ${
        finished ? 'border-border bg-card hover:border-primary/40' : 'border-primary bg-primary/5 hover:bg-primary/10'
      }`}
    >
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
        finished ? 'bg-success/10 text-success' : 'bg-primary text-primary-foreground'
      }`}>
        {finished ? <Check className="h-5 w-5" /> : <Languages className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">Daily translation challenge</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
      {!finished && progress !== null && (
        <span className="flex shrink-0 gap-1" aria-hidden>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-2 w-2 rounded-full ${i < done ? 'bg-primary' : 'bg-muted-foreground/25'}`} />
          ))}
        </span>
      )}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
};
