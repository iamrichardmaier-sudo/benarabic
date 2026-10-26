/**
 * The scripts a flashcard's Arabic can be shown in, one unlocked per level,
 * from plain print to the hardest manuscript hands. All are free Google Fonts
 * that draw the vowel marks properly (checked by rendering
 * كَتَبَ يَكْتُبُ كِتَابٌ مُسْتَشْفًى in each; Badeen Display and Blaka failed that
 * and are left out). There is no free web font for Diwani or Thuluth.
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
  { id: 'scheherazade', level: 2, name: 'Scheherazade', arabic: 'شَهْرَزَاد', blurb: 'A roomy book Naskh, drawn for clear vowel marks.', family: 'Scheherazade New' },
  { id: 'amiri', level: 3, name: 'Amiri', arabic: 'أَمِيرِي', blurb: 'Classic book Naskh, after the old Būlāq press.', family: 'Amiri' },
  { id: 'messiri', level: 4, name: 'Messiri', arabic: 'المِسِيرِي', blurb: 'A modern display face with round, open letters.', family: 'El Messiri' },
  { id: 'kufi', level: 5, name: 'Kufi', arabic: 'كُوفِي', blurb: 'Square, geometric letters, the oldest calligraphic style.', family: 'Reem Kufi' },
  { id: 'mushaf', level: 6, name: 'Muṣḥaf Naskh', arabic: 'مُصْحَف', blurb: 'Amiri’s Qurʾān edition, set the way a printed muṣḥaf is.', family: 'Amiri Quran' },
  { id: 'ruqah', level: 7, name: 'Ruqʿah', arabic: 'رُقْعَة', blurb: 'Quick handwriting, the way Arabic is written by hand.', family: 'Aref Ruqaa' },
  { id: 'kufam', level: 8, name: 'Wide Kufi', arabic: 'كُوفِي عَرِيض', blurb: 'Kufi drawn long and light, with stretched baselines.', family: 'Kufam' },
  { id: 'katibeh', level: 9, name: 'Katibeh', arabic: 'كَاتِبَة', blurb: 'A tall, high-contrast display script.', family: 'Katibeh' },
  { id: 'nastaliq', level: 10, name: 'Nastaʿlīq', arabic: 'نَسْتَعْلِيق', blurb: 'The sweeping, hanging script of Persian calligraphy.', family: 'Gulzar' },
  { id: 'kano', level: 11, name: 'Kano', arabic: 'كَانُو', blurb: 'The West African hand of Kano, northern Nigeria.', family: 'Alkalami' },
  { id: 'vibes', level: 12, name: 'Vibes', arabic: 'خَطّ حُرّ', blurb: 'A light, looping freehand script.', family: 'Vibes' },
  { id: 'rakkas', level: 13, name: 'Rakkas', arabic: 'رَقَّاص', blurb: 'A bold, dancing display script.', family: 'Rakkas' },
  { id: 'jali-nastaliq', level: 14, name: 'Jali Nastaʿlīq', arabic: 'نَسْتَعْلِيق جَلِيّ', blurb: 'Nastaʿlīq at its grandest, with deep sweeps and stacked letters.', family: 'Noto Nastaliq Urdu' },
  { id: 'qahiri', level: 15, name: 'Manuscript Kufi', arabic: 'كُوفِي المَصَاحِف', blurb: 'The Kufi of early Qurʾān manuscripts. The hardest to read, and the last one.', family: 'Qahiri' },
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
