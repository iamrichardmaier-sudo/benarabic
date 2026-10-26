import { useEffect } from 'react';
import { useProgress } from '@/hooks/useProgress';
import { applyTheme } from '@/lib/preferences';
import { levelFor } from '@/lib/levels';
import { backgroundById } from './backgrounds';

/**
 * The chosen level background, fixed behind the whole app.
 *
 * Rendered at z-index −1 inside the app's root (which isolates a stacking
 * context), so it sits above the page colour and below every screen. A night
 * scene also switches the app to its dark palette and turns cards slightly
 * translucent, so the art shows while text stays readable.
 */
const AppBackground = () => {
  const { background, xp } = useProgress();
  const chosen = backgroundById(background);
  // A background above the learner's level (e.g. a stale choice from another
  // device after the curve changed) falls back to the plain one.
  const bg = chosen.level <= levelFor(xp) ? chosen : backgroundById(null);
  const scene = bg.tone === 'dark';

  const art = Boolean(bg.Art);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('wz-scene', scene);
    root.classList.toggle('wz-art', art);
    applyTheme();
    return () => {
      root.classList.remove('wz-scene', 'wz-art');
      applyTheme();
    };
  }, [scene, art]);

  if (!bg.Art) return null;
  const Art = bg.Art;
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <Art />
    </div>
  );
};

export default AppBackground;
