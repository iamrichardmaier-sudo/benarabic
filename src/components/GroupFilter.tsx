import { Layers3 } from 'lucide-react';

interface GroupFilterProps {
  /** Every named group present in the deck, already sorted. */
  groups: string[];
  /** The group being studied, or null for the whole deck. */
  active: string | null;
  onChange: (group: string | null) => void;
  /** How many cards each group holds, for the chip labels. */
  counts: Record<string, number>;
  totalCount: number;
}

/**
 * Narrows study to one batch of words. Always offers the way back to the whole
 * deck, so turning a filter on is never a one-way door.
 */
const GroupFilter = ({ groups, active, onChange, counts, totalCount }: GroupFilterProps) => {
  if (groups.length === 0) return null;

  const chip = (label: string, count: number, isActive: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      aria-pressed={isActive}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        isActive
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      <span>{label}</span>
      <span className={isActive ? 'opacity-80' : 'opacity-60'}>{count}</span>
    </button>
  );

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Layers3 className="h-3.5 w-3.5" />
        Studying
      </p>
      <div className="flex flex-wrap gap-2">
        {chip('All words', totalCount, active === null, () => onChange(null))}
        {groups.map((group) =>
          chip(group, counts[group] ?? 0, active === group, () => onChange(group)),
        )}
      </div>
    </div>
  );
};

export default GroupFilter;
