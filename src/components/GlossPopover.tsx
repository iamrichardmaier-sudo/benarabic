import { useState, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface GlossPopoverProps {
  /** Heading of the bubble — the thing being explained. */
  title: string;
  /** Optional short label between the title and the explanation. */
  subtitle?: string;
  body: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Accessible name for the trigger, e.g. "What the root ك-ت-ب means". */
  triggerLabel: string;
  className?: string;
  children: ReactNode;
}

/**
 * A hint that opens on hover for a mouse and on tap for a phone.
 *
 * Radix's Tooltip is hover- and focus-only, which would leave the explanation
 * unreachable on a touch screen — most of this app's use. Popover handles the
 * tap, and the hover handlers layer desktop behaviour on top.
 */
const GlossPopover = ({
  title,
  subtitle,
  body,
  side = 'top',
  triggerLabel,
  className,
  children,
}: GlossPopoverProps) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          // Radix toggles on click, which would immediately shut a bubble that
          // hovering had just opened. Preventing default skips its handler and
          // leaves opening entirely to us; a click outside still dismisses it.
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
          }}
          className={`cursor-help rounded-lg decoration-dotted underline-offset-4 transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className ?? ''}`}
        >
          {children}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        className="w-72 space-y-1.5"
        // Hovering the bubble itself should not dismiss it mid-sentence.
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        // Opening on hover must not yank focus away from what the user is typing.
        onOpenAutoFocus={(e) => e.preventDefault()}
        // Nor may closing hand focus back to the trigger: that fires onFocus,
        // which would reopen the bubble the moment the pointer leaves it.
        // Focus never left the trigger anyway, since opening does not take it.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <p className="font-arabic text-lg font-bold text-foreground" dir="rtl">
          {title}
        </p>
        {subtitle && <p className="text-xs font-medium text-primary">{subtitle}</p>}
        <p className="text-sm leading-snug text-muted-foreground">{body}</p>
      </PopoverContent>
    </Popover>
  );
};

export default GlossPopover;
