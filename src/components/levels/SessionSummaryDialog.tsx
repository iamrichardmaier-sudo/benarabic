import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BACKGROUNDS } from '@/components/backgrounds/backgrounds';
import BackgroundThumb from '@/components/levels/BackgroundThumb';
import LevelBar from '@/components/levels/LevelBar';
import { levelFor } from '@/lib/levels';

export interface SessionSummary {
  /** XP before and after; `earned` is absent for XP earned elsewhere (the widget). */
  startXp: number;
  endXp: number;
  earned?: number;
  /** "Review", "Practice" or "Learn". */
  label?: string;
}

interface Props {
  summary: SessionSummary | null;
  onUseBackground: (id: string) => void;
  onClose: () => void;
}

/** Shown when a study session ends: XP earned, the level bar, and any background unlocked. */
const SessionSummaryDialog = ({ summary, onUseBackground, onClose }: Props) => {
  const from = summary ? levelFor(summary.startXp) : 1;
  const to = summary ? levelFor(summary.endXp) : 1;
  const unlocked = BACKGROUNDS.filter((b) => b.level > from && b.level <= to);
  const newest = unlocked[unlocked.length - 1];
  const levelUp = to > from;

  return (
    <Dialog open={summary !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        {summary && (
          <>
            <DialogHeader className="items-center text-center">
              {levelUp && (
                <span className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Sparkles className="h-6 w-6" />
                </span>
              )}
              <DialogTitle className="text-xl">
                {levelUp ? `Level ${to}!` : `${summary.label ?? 'Session'} done`}
              </DialogTitle>
              <DialogDescription>
                {summary.earned !== undefined ? (
                  <span className="text-2xl font-bold text-primary tabular-nums">+{summary.earned} XP</span>
                ) : (
                  'You levelled up on the widget.'
                )}
              </DialogDescription>
            </DialogHeader>

            <LevelBar xp={summary.endXp} fromXp={summary.startXp} />

            {newest && (
              <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  New background unlocked
                  {unlocked.length > 1 && ` (+${unlocked.length - 1} more)`}
                </p>
                <div className="flex gap-3">
                  <BackgroundThumb bg={newest} className="aspect-[3/4] w-20 shrink-0 rounded-lg border border-border" />
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-foreground">{newest.name}</p>
                    <p className="font-arabic text-lg text-foreground" dir="rtl" lang="ar">{newest.arabic}</p>
                    <p className="text-xs text-muted-foreground">{newest.blurb}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => { onUseBackground(newest.id); onClose(); }}>
                    Use it now
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={onClose}>
                    Keep current
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">You can switch any time in Settings.</p>
              </div>
            )}

            {!newest && (
              <Button onClick={onClose} className="w-full">Continue</Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SessionSummaryDialog;
