/**
 * The keys a deck's icon can be, kept apart from the component that draws
 * them so the pickers and helpers can import them without pulling in React.
 *
 * DeckIcon maps every key here to a glyph, and TypeScript enforces that the
 * map is complete — add a key and the build tells you it needs a drawing.
 */
export const DECK_ICON_KEYS = [
  'foundation', 'compass', 'scroll', 'lantern', 'bridge', 'anchor',
  'feather', 'flame', 'footprints', 'gem', 'leaf', 'lightbulb',
  'map', 'mountain', 'ship', 'sparkles', 'sprout', 'sun',
  'tent', 'waves', 'wheat', 'book', 'key',
] as const;

export type DeckIconKey = (typeof DECK_ICON_KEYS)[number];

/**
 * Arabic 101 is marked apart on purpose: it is not one chapter among many but
 * everything learned before the numbered chapters begin, so it gets the
 * filled treatment while the chapter decks stay outlined.
 */
export const FOUNDATION_ICON: DeckIconKey = 'foundation';

/** The next unused icon, so a new deck does not repeat one already taken. */
export function nextFreeIcon(taken: Iterable<string>): DeckIconKey {
  const used = new Set(taken);
  return DECK_ICON_KEYS.find((k) => k !== FOUNDATION_ICON && !used.has(k)) ?? 'book';
}
