/**
 * Every icon the Wazn set draws, kept apart from the component that draws
 * them — the same split `deck-icons.ts` already makes, and for the same
 * reason: a picker or a test can ask what icons exist without pulling React
 * in behind it.
 */
export const WAZN_ICON_NAMES = [
  'foundation', 'compass', 'scroll', 'lantern', 'bridge', 'anchor', 'feather', 'flame',
  'footprints', 'gem', 'leaf', 'lightbulb', 'map', 'mountain', 'ship', 'sparkles',
  'sprout', 'sun', 'tent', 'waves', 'wheat', 'book', 'key', 'home', 'learn', 'review',
  'decks', 'build', 'add', 'search', 'settings', 'streak', 'conjugation', 'preposition',
  'numbers', 'memorize', 'audio', 'import', 'speak', 'relearn', 'mastered', 'practice',
] as const;

export type WaznIconName = (typeof WAZN_ICON_NAMES)[number];
