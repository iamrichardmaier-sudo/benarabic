import { useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface InfoHintProps {
  /** Read by a screen reader in place of visible text on the trigger itself. */
  label: string;
  children: ReactNode;
}

/**
 * A small "what does this mean" trigger for a term the app uses but never
 * defines on its own — Fusha/Shaami, a verb form, a masdar. Tap rather than
 * hover, since the terms this exists for show up on phones first.
 */
const InfoHint = ({ label, children }: InfoHintProps) => {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 text-sm leading-snug text-foreground"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
};

export default InfoHint;
