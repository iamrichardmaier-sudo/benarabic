import { useEffect, useState } from 'react';
import { progressFor, titleFor, MAX_LEVEL } from '@/lib/levels';

interface LevelBarProps {
  xp: number;
  /** Animate the bar from this XP (e.g. where a session started). */
  fromXp?: number;
  compact?: boolean;
}

/** Level number, a bar through the current level, and what is left to the next. */
const LevelBar = ({ xp, fromXp, compact = false }: LevelBarProps) => {
  const p = progressFor(xp);
  const start = fromXp !== undefined && progressFor(fromXp).level === p.level ? progressFor(fromXp).fraction : 0;
  const [shown, setShown] = useState(fromXp !== undefined ? start : p.fraction);
  useEffect(() => {
    const t = setTimeout(() => setShown(p.fraction), 120);
    return () => clearTimeout(t);
  }, [p.fraction]);

  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      <div className="flex items-baseline justify-between gap-3">
        <span className={`flex items-baseline gap-2 font-bold text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
          Level {p.level}
          <span className="font-arabic font-semibold text-primary" dir="rtl" lang="ar">{titleFor(p.level).ar}</span>
          {!compact && <span className="text-xs font-normal text-muted-foreground">{titleFor(p.level).en}</span>}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {p.next === null
            ? `${xp.toLocaleString('en')} XP · top level`
            : `${(xp - p.floor).toLocaleString('en')} / ${(p.next - p.floor).toLocaleString('en')} XP`}
        </span>
      </div>
      <div
        className={`overflow-hidden rounded-full bg-muted ${compact ? 'h-1.5' : 'h-2.5'}`}
        role="progressbar"
        aria-label={`Level ${p.level} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.fraction * 100)}
      >
        <div className="h-full rounded-full bg-primary transition-[width] duration-1000 ease-out" style={{ width: `${shown * 100}%` }} />
      </div>
      {!compact && p.next !== null && (
        <p className="text-xs text-muted-foreground">
          {p.toNext.toLocaleString('en')} XP to Level {Math.min(p.level + 1, MAX_LEVEL)}
        </p>
      )}
    </div>
  );
};

export default LevelBar;
