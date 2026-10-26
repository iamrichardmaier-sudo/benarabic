/**
 * The scripts a flashcard's Arabic can be shown in, one more unlocked every
 * few levels. All are free Google Fonts that draw the vowel marks properly
 * (checked by rendering كَتَبَ يَكْتُبُ كِتَابٌ مُسْتَشْفًى in each). There is no
 * free web font for Diwani or Thuluth, so the set stops at the styles that
 * exist and read well.
 */
export interface CardFont {
  id: string;
  level: number;
  name: string;
  arabic: string;
  blurb: string;
  /** CSS font-family name, as Google Fonts serves it. */
  family: string;
}

export const CARD_FONTS: CardFont[] = [
  { id: 'naskh', level: 1, name: 'Naskh', arabic: 'نَسْخ', blurb: 'The clear everyday print of books and screens.', family: 'Noto Naskh Arabic' },
  { id: 'amiri', level: 3, name: 'Amiri', arabic: 'أَمِيرِي', blurb: 'Classic book Naskh, after the old Būlāq press.', family: 'Amiri' },
  { id: 'kufi', level: 5, name: 'Kufi', arabic: 'كُوفِي', blurb: 'Square, geometric letters, the oldest calligraphic style.', family: 'Reem Kufi' },
  { id: 'ruqah', level: 8, name: 'Ruqʿah', arabic: 'رُقْعَة', blurb: 'Quick handwriting, the way Arabic is written by hand.', family: 'Aref Ruqaa' },
  { id: 'nastaliq', level: 11, name: 'Nastaʿlīq', arabic: 'نَسْتَعْلِيق', blurb: 'The sweeping, hanging script of Persian calligraphy.', family: 'Gulzar' },
  { id: 'rakkas', level: 14, name: 'Rakkas', arabic: 'رَقَّاص', blurb: 'A bold, dancing display script.', family: 'Rakkas' },
];

export function cardFontById(id: string | null | undefined): CardFont {
  return CARD_FONTS.find((f) => f.id === id) ?? CARD_FONTS[0];
}

/** The font to actually use: the chosen one if the level allows it, else Naskh. */
export function effectiveCardFont(id: string | null | undefined, level: number): CardFont {
  const f = cardFontById(id);
  return f.level <= level ? f : CARD_FONTS[0];
}

const loaded = new Set<string>();

/**
 * Loads a font from Google Fonts once. With `text`, only the glyphs for that
 * text are fetched (a few kilobytes), which is all a preview needs.
 */
export function loadCardFont(font: CardFont, text?: string): void {
  if (typeof document === 'undefined' || font.id === 'naskh') return; // Naskh ships with the app
  const k = `${font.id}|${text ?? ''}`;
  if (loaded.has(k)) return;
  loaded.add(k);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href =
    `https://fonts.googleapis.com/css2?family=${font.family.replace(/ /g, '+')}&display=swap` +
    (text ? `&text=${encodeURIComponent(text)}` : '');
  document.head.appendChild(link);
}
