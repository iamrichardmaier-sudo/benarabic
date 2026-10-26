import { useEffect } from 'react';
import { Check, Lock } from 'lucide-react';
import { CARD_FONTS, effectiveCardFont, loadCardFont } from '@/lib/card-fonts';
import { usePreferences } from '@/hooks/usePreferences';
import { useProgress } from '@/hooks/useProgress';
import { levelFor } from '@/lib/levels';
import { setCardFont } from '@/lib/preferences';

const SAMPLE = 'كِتَابٌ';

/** Settings: the script flashcards show their Arabic in, unlocked by level. */
const CardFontPicker = () => {
  const { cardFont } = usePreferences();
  const level = levelFor(useProgress().xp);
  const current = effectiveCardFont(cardFont, level).id;

  // Only the sample word's glyphs, so previews cost a few kilobytes each.
  useEffect(() => {
    for (const f of CARD_FONTS) loadCardFont(f, SAMPLE);
  }, []);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm text-foreground">Flashcard script</p>
        <p className="text-xs text-muted-foreground">How the Arabic on your cards is written. New scripts unlock as you level up.</p>
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Flashcard script">
        {CARD_FONTS.map((f) => {
          const locked = f.level > level;
          const selected = f.id === current;
          return (
            <li key={f.id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={locked}
                aria-label={locked ? `${f.name}, unlocks at level ${f.level}` : `${f.name}: ${f.blurb}`}
                title={f.blurb}
                onClick={() => setCardFont(f.id)}
                className={`relative flex w-full flex-col items-center gap-0.5 rounded-xl border-2 px-2 pb-2 pt-1 transition-colors disabled:cursor-not-allowed ${
                  selected ? 'border-primary bg-primary/5' : 'border-border/60 hover:enabled:border-primary/50'
                }`}
              >
                <span
                  className={`text-[30px] leading-[1.6] text-foreground ${locked ? 'opacity-35 blur-[1px]' : ''}`}
                  style={{ fontFamily: `'${f.family}', var(--font-arabic)` }}
                  dir="rtl"
                  lang="ar"
                >
                  {SAMPLE}
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-foreground">
                  {locked && <Lock className="h-3 w-3" />}
                  {f.name}
                </span>
                <span className="text-[11px] text-muted-foreground">{locked ? `Level ${f.level}` : <span className="font-arabic" dir="rtl" lang="ar">{f.arabic}</span>}</span>
                {selected && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default CardFontPicker;
