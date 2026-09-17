import {
  Anchor, Compass, Feather, Flame, Footprints, Gem, Landmark,
  Leaf, Lightbulb, Map, Mountain, Scroll, Ship, Sparkles, Sprout,
  Sun, Tent, Waves, Wheat, BookOpen, Key, Lamp, Puzzle,
} from 'lucide-react';
import { type DeckIconKey } from '@/lib/deck-icons';

/**
 * The deck icon set.
 *
 * Drawn from one family of line icons so the browse list reads as a set
 * rather than a pile of clip art, and each deck is given its own so a learner
 * comes to recognise a deck by its mark rather than by reading every title.
 *
 * Bridge is not in the icon font; Puzzle stands in for it, which is why the
 * map and not the component name is what a deck stores.
 */
const ICONS: Record<DeckIconKey, typeof BookOpen> = {
  foundation: Landmark,
  compass: Compass,
  scroll: Scroll,
  lantern: Lamp,
  bridge: Puzzle,
  anchor: Anchor,
  feather: Feather,
  flame: Flame,
  footprints: Footprints,
  gem: Gem,
  leaf: Leaf,
  lightbulb: Lightbulb,
  map: Map,
  mountain: Mountain,
  ship: Ship,
  sparkles: Sparkles,
  sprout: Sprout,
  sun: Sun,
  tent: Tent,
  waves: Waves,
  wheat: Wheat,
  book: BookOpen,
  key: Key,
} as const;


interface DeckIconProps {
  icon: string;
  /** Marks the foundational deck, which is styled as filled rather than outlined. */
  foundation?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const DeckIcon = ({ icon, foundation = false, size = 'md', className = '' }: DeckIconProps) => {
  const Glyph = ICONS[icon as DeckIconKey] ?? ICONS.book;
  const box = size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';
  const glyph = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-xl border ${box} ${
        foundation
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-muted/40 text-primary'
      } ${className}`}
    >
      <Glyph className={glyph} />
    </span>
  );
};

export default DeckIcon;
