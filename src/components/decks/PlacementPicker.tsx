import WaznIcon from '@/components/icons/WaznIcon';
import type { WaznIconName } from '@/lib/wazn-icons';
import { PLACEMENTS, type DeckPlacement } from '@/lib/deck-placement';

const ICONS: Record<DeckPlacement, WaznIconName> = {
  learn: 'learn',
  review: 'review',
  mastered: 'mastered',
};

interface PlacementPickerProps {
  value: DeckPlacement;
  onChange: (placement: DeckPlacement) => void;
}

/**
 * Where the words should land.
 *
 * Shown before adding rather than after, because this is not a setting to go
 * back and fix — the choice writes the cards' starting schedule, and changing
 * your mind later means relearning or resetting them by hand. Each option
 * says what it does to the flashcards in the words a learner would use, since
 * "graduated with a thirty-day interval" is not a sentence anyone should have
 * to decode to pick up a deck.
 */
const PlacementPicker = ({ value, onChange }: PlacementPickerProps) => (
  <fieldset className="space-y-2">
    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      How well do you know these?
    </legend>
    <div className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border/60">
      {PLACEMENTS.map((p) => {
        const icon = ICONS[p.id];
        const picked = p.id === value;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={picked}
            className={`flex w-full items-center gap-3 px-4 py-3 text-start transition-colors ${
              picked ? 'bg-primary/10' : 'hover:bg-muted/40'
            }`}
          >
            <WaznIcon
              name={icon}
              size={34}
              className={picked ? 'text-primary' : 'text-muted-foreground'}
            />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm font-semibold ${picked ? 'text-primary' : 'text-foreground'}`}>
                {p.label}
              </span>
              <span className="block text-xs text-muted-foreground">{p.hint}</span>
            </span>
            <span
              className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                picked ? 'border-primary bg-primary' : 'border-border'
              }`}
            />
          </button>
        );
      })}
    </div>
  </fieldset>
);

export default PlacementPicker;
