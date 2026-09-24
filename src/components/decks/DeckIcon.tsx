import WaznIcon from '@/components/icons/WaznIcon';
import type { WaznIconName } from '@/lib/wazn-icons';
import { DECK_ICON_KEYS, type DeckIconKey } from '@/lib/deck-icons';

/**
 * A deck's mark.
 *
 * Every deck icon key is also a Wazn icon name — the assignment below is what
 * makes TypeScript prove it, so adding a deck key without drawing it is a
 * build error rather than a blank tile.
 */
const asIcon = (key: DeckIconKey): WaznIconName => key;

/**
 * Sizes, and why there are four of them.
 *
 * These drawings carry interlace and medallion rings, which need room: shrink
 * one to a list-row glyph and the ornament closes into a blot. So the deck
 * surfaces give it room instead — `face` fills a card, `lg` heads a screen —
 * and `sm` exists only for the few places a deck still has to appear inline.
 */
const SIZES = {
  sm: { box: 'h-10 w-10 rounded-xl border', glyph: 22 },
  md: { box: 'h-14 w-14 rounded-2xl border', glyph: 32 },
  lg: { box: 'h-20 w-20 rounded-2xl border', glyph: 48 },
  face: { box: 'h-full w-full rounded-none border-0', glyph: 76 },
} as const;

interface DeckIconProps {
  icon: string;
  /**
   * A drawn mark of this deck's own, as a path under the app's base. It is an
   * alpha mask rather than a picture, so it is painted with `currentColor`
   * like the built-in marks and works on a filled card and in dark mode.
   */
  iconUrl?: string | null;
  /** Marks the foundational deck, which is filled rather than outlined. */
  foundation?: boolean;
  size?: keyof typeof SIZES;
  className?: string;
}

const DeckIcon = ({
  icon, iconUrl, foundation = false, size = 'md', className = '',
}: DeckIconProps) => {
  // A deck stores its icon as free text, so an unknown value gets the default
  // rather than an empty tile.
  const known = (DECK_ICON_KEYS as readonly string[]).includes(icon)
    ? (icon as DeckIconKey)
    : 'book';
  const { box, glyph } = SIZES[size];

  // A relative path, resolved against the app's base — the site is served
  // from a subpath on GitHub Pages, where a leading slash would miss.
  const mask = iconUrl ? `${import.meta.env.BASE_URL}${iconUrl.replace(/^\//, '')}` : null;

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center ${box} ${
        foundation
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-muted/40 text-primary'
      } ${className}`}
    >
      {mask ? (
        <span
          style={{
            width: glyph,
            height: glyph,
            backgroundColor: 'currentColor',
            WebkitMaskImage: `url(${mask})`,
            maskImage: `url(${mask})`,
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
      ) : (
        <WaznIcon name={asIcon(known)} size={glyph} />
      )}
    </span>
  );
};

export default DeckIcon;
