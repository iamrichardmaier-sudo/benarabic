import { Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BACKGROUNDS } from '@/components/backgrounds/backgrounds';
import BackgroundThumb from '@/components/levels/BackgroundThumb';
import LevelBar from '@/components/levels/LevelBar';
import { levelFor, titleFor } from '@/lib/levels';
import { CARD_FONTS } from '@/lib/card-fonts';
import type { BadgeDef } from '@/lib/badges';
import BadgeIcon from '@/components/levels/BadgeIcon';
import GoalRing from '@/components/levels/GoalRing';
import { Check } from 'lucide-react';

export interface SessionSummary {
  /** XP before and after; `earned` is absent for XP earned elsewhere (the widget). */
  startXp: number;
  endXp: number;
  earned?: number;
  /** "Review", "Practice" or "Learn". */
  label?: string;
  /** This session took today's XP past the daily goal. */
  goalReached?: boolean;
  /** Badges earned in this session. */
  badges?: BadgeDef[];
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
  const fonts = CARD_FONTS.filter((f) => f.level > from && f.level <= to);

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
              {levelUp && (
                <p className="text-sm text-foreground">
                  You are now a{/^[AEIOU]/.test(titleFor(to).en) ? 'n' : ''} {titleFor(to).en.toLowerCase()},{' '}
                  <span className="font-arabic text-lg font-semibold text-primary" dir="rtl" lang="ar">{titleFor(to).ar}</span>
                </p>
              )}
              <DialogDescription>
                {summary.earned !== undefined ? (
                  <span className="text-2xl font-bold text-primary tabular-nums">+{summary.earned} XP</span>
                ) : (
                  'Nice work. You reached a new level since you were last here.'
                )}
              </DialogDescription>
            </DialogHeader>

            {summary.goalReached && (
              <div className="flex items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-3 py-2">
                <GoalRing value={1} goal={1} size={32}>
                  <Check className="h-4 w-4 text-success" />
                </GoalRing>
                <p className="text-sm font-medium text-foreground">Daily goal reached</p>
              </div>
            )}

            {summary.badges && summary.badges.length > 0 && (
              <ul className="space-y-2">
                {summary.badges.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2">
                    <BadgeIcon kind={b.icon} earned size={40} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Badge earned</p>
                      <p className="text-sm font-semibold text-foreground">
                        {b.name} <span className="font-arabic font-normal text-primary" dir="rtl" lang="ar">{b.arabic}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{b.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {fonts.length > 0 && (
              <p className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                New card script unlocked:{' '}
                <span className="font-semibold">{fonts.map((f) => f.name).join(', ')}</span>{' '}
                <span className="text-lg" style={{ fontFamily: `'${fonts[fonts.length - 1].family}', var(--font-arabic)` }} dir="rtl" lang="ar">
                  {fonts[fonts.length - 1].arabic}
                </span>
                <span className="block text-xs text-muted-foreground">Choose it in Settings.</span>
              </p>
            )}

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
