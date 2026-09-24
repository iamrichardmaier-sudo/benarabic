/**
 * Every icon the Wazn set draws — one per deck mark, kept apart from the
 * component that draws them, the same split `deck-icons.ts` already makes and
 * for the same reason: a picker or a test can ask what exists without pulling
 * React in behind it.
 *
 * This list and `DECK_ICON_KEYS` cover the same ground, deliberately from two
 * directions: that one says which marks a deck may choose, this one says
 * which are drawn, and a test holds them to each other.
 */
export const WAZN_ICON_NAMES = [
  'mihrab', 'foundation', 'compass', 'scroll', 'lantern', 'bridge', 'anchor', 'feather', 'flame',
  'footprints', 'gem', 'leaf', 'lightbulb', 'map', 'mountain', 'ship', 'sparkles',
  'sprout', 'sun', 'tent', 'waves', 'wheat', 'book', 'key',
] as const;

export type WaznIconName = (typeof WAZN_ICON_NAMES)[number];
