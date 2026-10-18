import { heatCells, TIER_LABELS } from '@/lib/verb-forms/quiz';
import type { Conjugation } from '@/lib/verb-forms/data';
import type { FormId } from '@/lib/verb-forms/generate';

const TIER_CLASS = [
  'bg-muted text-muted-foreground',
  'bg-primary/15 text-foreground',
  'bg-primary/35 text-foreground',
  'bg-primary/60 text-primary-foreground',
  'bg-primary text-primary-foreground',
];

interface HeatMapProps {
  rows: Conjugation[];
  /** The form the learner holds, ringed so they can find it. */
  mine?: FormId | null;
}

/** The ten forms of one root, shaded by how much each is used. */
const HeatMap = ({ rows, mine }: HeatMapProps) => (
  <div className="space-y-2">
    <div className="grid grid-cols-5 gap-2" dir="ltr">
      {heatCells(rows).map(({ form, tier, row }) => (
        <div
          key={form}
          title={`Form ${form}: ${TIER_LABELS[tier]}`}
          className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2 ${TIER_CLASS[tier]} ${
            mine === form ? 'ring-2 ring-foreground ring-offset-2 ring-offset-background' : ''
          }`}
        >
          <span className="text-xs font-bold">{form}</span>
          <span className="font-arabic text-sm leading-tight" dir="rtl">{row ? row.past : '—'}</span>
          <span className="text-[10px] opacity-80">{TIER_LABELS[tier]}</span>
        </div>
      ))}
    </div>
    <p className="text-center text-[11px] text-muted-foreground">
      Usage is an estimate. Gray means no such verb turned up for this root.
    </p>
  </div>
);

export default HeatMap;
