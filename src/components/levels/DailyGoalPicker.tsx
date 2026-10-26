import { usePreferences } from '@/hooks/usePreferences';
import { DAILY_GOALS, setDailyGoal } from '@/lib/preferences';
import { FREEZE_XP, MAX_FREEZES } from '@/lib/streak';

/** Settings: how much XP a day fills the ring on Home. */
const DailyGoalPicker = () => {
  const { dailyGoal } = usePreferences();
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-foreground">Daily goal</p>
        <p className="text-xs text-muted-foreground">
          Every {FREEZE_XP.toLocaleString('en')} XP also earns a streak freeze (you can hold {MAX_FREEZES}). A freeze
          covers a missed day automatically, so one day off does not end your streak.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Daily goal">
        {DAILY_GOALS.map((g) => (
          <button
            key={g.xp}
            type="button"
            role="radio"
            aria-checked={dailyGoal === g.xp}
            onClick={() => setDailyGoal(g.xp)}
            className={`rounded-xl border-2 px-1 py-1.5 text-center transition-colors ${
              dailyGoal === g.xp ? 'border-primary bg-primary/5' : 'border-border/60 hover:border-primary/50'
            }`}
          >
            <span className="block text-xs font-semibold text-foreground">{g.label}</span>
            <span className="block text-[11px] tabular-nums text-muted-foreground">{g.xp} XP</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {DAILY_GOALS.find((g) => g.xp === dailyGoal)?.hint} graded “Good” a day.
      </p>
    </div>
  );
};

export default DailyGoalPicker;
