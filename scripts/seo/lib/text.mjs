/** Arabic text helpers shared by the static page generator. */

const TRANSLIT = {
  'ء': 'a', 'آ': 'a', 'أ': 'a', 'إ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's',
  'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'ى': 'y', 'ة': 'h', 'ئ': 'a', 'ؤ': 'a',
};

/** URL slug for a root: "ك-ت-ب" -> "k-t-b". */
export function rootSlugBase(root) {
  return root
    .split('-')
    .map((seg) => [...seg].map((ch) => TRANSLIT[ch] ?? '').join(''))
    .filter(Boolean)
    .join('-');
}

const DIACRITICS = /[ً-ْٰـٓ-ٟۖ-ۭ]/g;

export function stripDiacritics(s) {
  return String(s ?? '').replace(DIACRITICS, '');
}

/** Mirrors normalizeArabic() in src/lib/arabic-normalize.ts. */
export function normalizeArabic(s) {
  return stripDiacritics(s)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

/**
 * Vocalized comparison key: keeps the vowels (so كِتَاب and كُتَّاب differ)
 * but ignores spelling variation that doesn't change the word: alif-wasla,
 * dagger alif, sukun, tatweel, and the order of shadda and its vowel.
 */
export function vocalKey(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/ٱ/g, 'ا')
    .replace(/ٰ/g, 'ا')
    .replace(/[ْـ]/g, '')
    .replace(/([ً-ِ])ّ/g, 'ّ$1')
    .trim();
}

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Wiktionary romanization -> plain ASCII the way people type it into a search
 * box: "kitāb" -> "kitab", "ʔistiqbāl" -> "istiqbal", "maḵzan" -> "makhzan".
 */
export function asciiTranslit(rom) {
  return String(rom ?? '')
    .toLowerCase()
    .replace(/ḵ|ẖ/g, 'kh')
    .replace(/ḏ/g, 'dh')
    .replace(/ṯ/g, 'th')
    .replace(/š/g, 'sh')
    .replace(/ḡ|ğ|ġ/g, 'gh')
    .replace(/ž/g, 'zh')
    .replace(/[ʔʕʿʾ'’`]/g, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** First short sense of a gloss, for titles: "book", "to write". */
export function shortGloss(g, max = 42) {
  let s = String(g ?? '').split(/[;,(]/)[0].trim().replace(/\.$/, '');
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`;
  return s;
}

export const FORM_ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
  'XI', 'XII', 'XIII', 'XIV', 'XV', 'Iq', 'IIq', 'IIIq', 'IVq'];
export const ROMAN_TO_NUM = Object.fromEntries(
  ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'].map((r, i) => [r, i + 1]),
);
export function formRank(f) {
  const i = FORM_ORDER.indexOf(f);
  return i === -1 ? 99 : i;
}
