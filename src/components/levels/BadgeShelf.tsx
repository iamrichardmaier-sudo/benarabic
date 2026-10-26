import { useMemo } from 'react';
import BadgeIcon from '@/components/levels/BadgeIcon';
import { BADGES, earnedBadges, type BadgeContext } from '@/lib/badges';
import { useDeck } from '@/contexts/DeckContext';
import { useProgress } from '@/hooks/useProgress';
import { useStreak } from '@/hooks/useStreak';
import { levelFor } from '@/lib/levels';
import { chaptersRead } from '@/lib/reading-log';
import { currentUserId } from '@/lib/progress';

const fmt = (day: string) =>
  new Date(`${day}T12:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

/** Settings: every badge, earned ones in colour with the date, the rest with progress. */
const BadgeShelf = () => {
  const cards = useDeck();
  const { xp } = useProgress();
  const streak = useStreak(currentUserId() ?? undefined);
  const ctx: BadgeContext = useMemo(
    () => ({ cards, longestStreak: streak.longest, chaptersRead: chaptersRead(), level: levelFor(xp) }),
    [cards, streak.longest, xp],
  );
  const earned = earnedBadges();
  const count = BADGES.filter((b) => earned[b.id]).length;

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5 space-y-3">
      <p className="text-xs text-muted-foreground">
        {count} of {BADGES.length} earned
      </p>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
        {BADGES.map((b) => {
          const when = earned[b.id];
          const p = b.progress(ctx);
          return (
            <li key={b.id} className="flex flex-col items-center gap-1 text-center" title={b.description}>
              <BadgeIcon kind={b.icon} earned={Boolean(when)} />
              <span className={`text-xs font-semibold leading-tight ${when ? 'text-foreground' : 'text-muted-foreground'}`}>{b.name}</span>
              <span className="font-arabic text-sm leading-tight text-primary" dir="rtl" lang="ar">{b.arabic}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {when ? fmt(when) : `${Math.min(p.value, p.goal).toLocaleString('en')} / ${p.goal.toLocaleString('en')}`}
              </span>
              <span className="sr-only">{b.description}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BadgeShelf;
