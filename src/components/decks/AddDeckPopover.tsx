import { useState, type ReactNode } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PlacementPicker from '@/components/decks/PlacementPicker';
import type { DeckPlacement } from '@/lib/deck-placement';

interface AddDeckPopoverProps {
  busy: boolean;
  onAdd: (placement: DeckPlacement) => void;
  /** The deck's own card/button — becomes the popover's trigger as-is. */
  children: ReactNode;
}

/**
 * Wraps a deck card on Home with a quick "how well do you know these?"
 * choice before it joins the learner's deck. Home stays glance-and-go — this
 * opens right where the deck was tapped rather than navigating to a full
 * preview screen, the way `DeckPreview`/`LearnDecks` do.
 */
const AddDeckPopover = ({ busy, onAdd, children }: AddDeckPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<DeckPlacement>('learn');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" className="space-y-3" onOpenAutoFocus={(e) => e.preventDefault()}>
        <PlacementPicker value={placement} onChange={setPlacement} />
        <button
          type="button"
          onClick={() => {
            onAdd(placement);
            setOpen(false);
          }}
          disabled={busy}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add
        </button>
      </PopoverContent>
    </Popover>
  );
};

export default AddDeckPopover;
