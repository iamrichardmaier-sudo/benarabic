import type { CSSProperties, ReactNode } from 'react';
import { Droplet, Heart, Leaf, Music2, Snowflake, Sparkle, Star } from 'lucide-react';
import { sceneForCard, type CardScene as Scene, type SceneFx } from '@/lib/card-scenes';
import { SCENE_ICONS } from '@/lib/card-scene-icons';
import { cn } from '@/lib/utils';

/** Where the five particles of an effect sit and when each starts, in % and s. */
const SPOTS = [
  { x: 18, y: 30, d: 0 },
  { x: 78, y: 24, d: 0.6 },
  { x: 30, y: 72, d: 1.2 },
  { x: 70, y: 68, d: 1.8 },
  { x: 50, y: 16, d: 2.4 },
];

/** Each effect: the particle it draws and the keyframes it moves on. */
const FX: Record<Exclude<SceneFx, 'none' | 'rays'>, { anim: string; draw: (i: number) => ReactNode }> = {
  sparkles: { anim: 'scene-twinkle', draw: () => <Sparkle className="h-3 w-3" fill="currentColor" /> },
  stars: { anim: 'scene-twinkle', draw: () => <Star className="h-2.5 w-2.5" fill="currentColor" /> },
  hearts: { anim: 'scene-rise', draw: () => <Heart className="h-3 w-3" fill="currentColor" /> },
  notes: { anim: 'scene-rise', draw: () => <Music2 className="h-3 w-3" /> },
  zzz: { anim: 'scene-rise', draw: (i) => <span className="text-[11px] font-bold">{i % 2 ? 'z' : 'Z'}</span> },
  bubbles: { anim: 'scene-rise', draw: () => <span className="block h-2 w-2 rounded-full border border-current" /> },
  steam: { anim: 'scene-steam', draw: () => <span className="block h-4 w-1 rounded-full bg-current opacity-60" /> },
  rain: { anim: 'scene-fall', draw: () => <span className="block h-2.5 w-0.5 rounded-full bg-current" /> },
  drops: { anim: 'scene-fall', draw: () => <Droplet className="h-2.5 w-2.5" fill="currentColor" /> },
  snow: { anim: 'scene-fall', draw: () => <Snowflake className="h-2.5 w-2.5" /> },
  leaves: { anim: 'scene-fall', draw: () => <Leaf className="h-3 w-3" fill="currentColor" /> },
  confetti: { anim: 'scene-fall', draw: (i) => <span className={cn('block h-1.5 w-1 rounded-sm', CONFETTI[i % CONFETTI.length])} /> },
  wind: { anim: 'scene-drift', draw: () => <span className="block h-0.5 w-5 rounded-full bg-current opacity-60" /> },
};
const CONFETTI = ['bg-primary', 'bg-success', 'bg-info', 'bg-warning', 'bg-destructive'];

interface CardSceneProps {
  /** A card, or anything with a stored scene and/or an English meaning to match. */
  card: { scene?: string | null; english?: string | null; wordType?: string | null };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = { sm: 'h-16 w-16', md: 'h-24 w-24', lg: 'h-32 w-32' };
const ICON_SIZES = { sm: 'h-7 w-7', md: 'h-10 w-10', lg: 'h-14 w-14' };

/**
 * A small looping scene that pictures what a card means — a cup with steam
 * rising for "coffee", a moon trailing z's for "to sleep". Decorative: the
 * meaning is always printed beside it, so it is hidden from screen readers,
 * and it holds still for anyone who has asked for reduced motion.
 */
const CardScene = ({ card, size = 'lg', className }: CardSceneProps) => {
  const scene: Scene = sceneForCard(card);
  const Icon = SCENE_ICONS[scene.icon];
  if (!Icon) return null;
  const fx = scene.fx !== 'none' && scene.fx !== 'rays' ? FX[scene.fx] : null;

  return (
    <div
      aria-hidden="true"
      data-scene={scene.key}
      className={cn('scene-tile relative mx-auto shrink-0 overflow-hidden rounded-3xl', `scene-tone-${scene.tone}`, SIZES[size], className)}
    >
      {scene.fx === 'rays' && <span className="scene-rays absolute inset-[-40%]" />}
      <span className="absolute inset-[18%] rounded-full bg-[hsl(var(--scene-h)_var(--scene-s)_60%/0.18)]" />
      {fx && SPOTS.map((s, i) => (
        <span
          key={i}
          className={cn('scene-particle absolute', fx.anim)}
          style={{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s` } as CSSProperties}
        >
          {fx.draw(i)}
        </span>
      ))}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className={cn('scene-ink inline-flex', `scene-motion-${scene.motion}`)}>
          <Icon className={ICON_SIZES[size]} strokeWidth={1.75} />
        </span>
      </span>
    </div>
  );
};

export default CardScene;
