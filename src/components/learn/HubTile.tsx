import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HubTileProps {
  icon: LucideIcon;
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  /** Why it cannot be opened yet; replaces the hint while disabled. */
  disabledHint?: string;
  /** "feature" is Today's pair; "compact" the row of everyday tools; "tool" the practice grid. */
  variant?: 'feature' | 'compact' | 'tool';
  /** A large figure for a feature tile: "14", "6". */
  figure?: string;
  /** Filled in the brand colour: the one thing to do next. */
  emphasis?: boolean;
}

/**
 * The Learn screen's one tile. Every entry on the screen is one of these, in
 * one of three sizes, so the page reads as a single system: same corners,
 * same border, same icon treatment, and every tile in a row the same height.
 */
const HubTile = ({
  icon: Icon, label, hint, onClick, disabled, disabledHint, variant = 'tool', figure, emphasis,
}: HubTileProps) => {
  const filled = emphasis && !disabled;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex h-full w-full text-start transition-all',
        'rounded-2xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
        'disabled:cursor-not-allowed',
        filled
          ? 'border-primary bg-primary text-primary-foreground shadow-md hover:shadow-lg active:scale-[0.99]'
          : 'border-border bg-card text-foreground hover:border-primary/40 hover:shadow-sm enabled:active:scale-[0.99]',
        variant === 'feature' && 'min-h-[9.5rem] flex-col justify-between rounded-3xl p-5',
        variant === 'compact' && 'items-center gap-3 px-4 py-3.5',
        variant === 'tool' && 'min-h-[7.25rem] flex-col gap-3 p-4',
      )}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl',
          variant === 'compact' ? 'h-9 w-9' : 'h-10 w-10',
          filled ? 'bg-primary-foreground/15 text-primary-foreground' : 'bg-primary/10 text-primary',
          disabled && 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className={variant === 'compact' ? 'h-[18px] w-[18px]' : 'h-5 w-5'} />
      </span>

      <span className={cn('min-w-0', variant === 'compact' && 'flex-1')}>
        {variant === 'feature' && figure !== undefined && (
          <span className={cn('block text-4xl font-bold tabular-nums leading-none', disabled && 'text-muted-foreground')}>
            {figure}
          </span>
        )}
        <span
          className={cn(
            'block font-semibold leading-snug',
            variant === 'feature' ? 'mt-2 text-base' : 'text-[15px]',
            disabled && !filled && 'text-muted-foreground',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'block text-xs leading-snug',
            variant === 'compact' ? 'truncate' : 'line-clamp-2',
            filled ? 'text-primary-foreground/80' : 'text-muted-foreground',
            variant !== 'compact' && 'mt-0.5',
          )}
        >
          {disabled && disabledHint ? disabledHint : hint}
        </span>
      </span>
    </button>
  );
};

export default HubTile;
