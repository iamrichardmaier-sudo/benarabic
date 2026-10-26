import { BookMarked, BookOpen, Crown, Flame, Shapes, Sprout, type LucideIcon } from 'lucide-react';
import type { BadgeIcon as Kind } from '@/lib/badges';

const ICONS: Record<Kind, LucideIcon> = {
  words: BookMarked,
  streak: Flame,
  root: Sprout,
  forms: Shapes,
  reading: BookOpen,
  crown: Crown,
};

/** A badge's medallion: an eight-pointed star with the badge's icon. */
const BadgeIcon = ({ kind, earned, size = 56 }: { kind: Kind; earned: boolean; size?: number }) => {
  const Icon = ICONS[kind];
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true">
        <g
          fill={earned ? 'hsl(var(--primary))' : 'hsl(var(--muted))'}
          stroke={earned ? '#d4af37' : 'hsl(var(--border))'}
          strokeWidth="3"
        >
          <rect x="-33" y="-33" width="66" height="66" rx="4" />
          <rect x="-33" y="-33" width="66" height="66" rx="4" transform="rotate(45)" />
        </g>
        <circle r="27" fill={earned ? 'hsl(var(--primary))' : 'hsl(var(--muted))'} />
      </svg>
      <Icon
        className={`absolute ${earned ? 'text-primary-foreground' : 'text-muted-foreground/60'}`}
        style={{ width: size * 0.36, height: size * 0.36 }}
      />
    </span>
  );
};

export default BadgeIcon;
