import { Check } from 'lucide-react';
import { BACKGROUNDS, backgroundById } from '@/components/backgrounds/backgrounds';
import BackgroundThumb from '@/components/levels/BackgroundThumb';
import LevelBar from '@/components/levels/LevelBar';
import { useProgress } from '@/hooks/useProgress';
import { levelFor } from '@/lib/levels';
import { setBackground } from '@/lib/progress';
import DailyGoalPicker from '@/components/levels/DailyGoalPicker';
import CardFontPicker from '@/components/levels/CardFontPicker';

/** Settings: the learner's level, and every background, unlocked ones choosable. */
const BackgroundPicker = () => {
  const { xp, background } = useProgress();
  const level = levelFor(xp);
  // A choice above the current level (it cannot normally happen) shows as the default.
  const chosen = backgroundById(background);
  const current = chosen.level <= level ? chosen.id : BACKGROUNDS[0].id;

  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3.5 space-y-4">
      <LevelBar xp={xp} />
      <DailyGoalPicker />
      <CardFontPicker />
      <div>
        <p className="text-sm text-foreground">Background</p>
        <p className="text-xs text-muted-foreground">
          Each level unlocks a new one. Earn XP by reviewing, practising and learning cards — on
          the widget too.
        </p>
      </div>
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5" role="radiogroup" aria-label="Background">
        {BACKGROUNDS.map((bg) => {
          const locked = bg.level > level;
          const selected = bg.id === current;
          return (
            <li key={bg.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked}
                aria-label={locked ? `${bg.name}, unlocks at level ${bg.level}` : bg.name}
                onClick={() => void setBackground(bg.id === 'parchment' ? null : bg.id)}
                className={`group block w-full text-left rounded-xl transition-transform disabled:cursor-not-allowed ${
                  locked ? '' : 'active:scale-95'
                }`}
              >
                <span
                  className={`relative block overflow-hidden rounded-xl border-2 ${
                    selected ? 'border-primary' : 'border-border/60 group-hover:group-enabled:border-primary/50'
                  }`}
                >
                  <BackgroundThumb bg={bg} locked={locked} className="aspect-[3/4]" />
                  {selected && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </span>
                <span className={`mt-1 block truncate text-[11px] ${locked ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {bg.name}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BackgroundPicker;
