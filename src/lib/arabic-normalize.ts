/**
 * Arabic text normalization for plural answer checking.
 * Strips diacritics and normalizes letter variants so users
 * are never penalized for missing tashkeel, alef variants, etc.
 */

/** Remove all tashkeel (short vowels, shadda, sukun, tanwin, etc.) */
export function stripTashkeel(str: string): string {
  return str.replace(/[\u064B-\u065F\u0670]/g, '');
}

/**
 * Remove tatweel (\u0640), the stylistic elongation mark used to write a clitic
 * preposition in isolation \u2014 \u0628\u0650\u0640, \u0644\u0650\u0640. Nobody types it; a citation form that
 * carries it must still match a bare typed answer.
 */
export function stripTatweel(str: string): string {
  return str.replace(/\u0640/g, '');
}

/** Normalize alef variants (أ إ آ ٱ) to bare alef (ا) */
function normalizeAlef(str: string): string {
  return str.replace(/[أإآٱ]/g, 'ا');
}

/** Normalize taa marbuuta (ة) to haa (ه) */
function normalizeTaaMarbuuta(str: string): string {
  return str.replace(/ة/g, 'ه');
}

/** Normalize alef maqsura (ى) to yaa (ي) */
function normalizeYaa(str: string): string {
  return str.replace(/ى/g, 'ي');
}

/** Full normalization pipeline */
export function normalizeArabic(str: string): string {
  return normalizeTaaMarbuuta(
    normalizeYaa(
      normalizeAlef(
        stripTashkeel(stripTatweel(str))
      )
    )
  ).trim().replace(/\s+/g, ' ');
}

/**
 * Normalize orthographic variants only (alef/yaa/taa marbuta) but KEEP
 * tashkeel — for drills that specifically grade whether the vowels were
 * typed correctly (e.g. conjugation drilling).
 */
export function normalizeArabicKeepVowels(str: string): string {
  return normalizeTaaMarbuuta(normalizeYaa(normalizeAlef(stripTatweel(str)))).trim().replace(/\s+/g, ' ');
}

/**
 * Remove short vowels, tanwin, sukun and the dagger alef, but deliberately
 * keep shadda (ّ). Gemination is what separates one verb form from
 * another — بَدَّلَ (II) from بَدَلَ (I) — so it stays graded even when a
 * drill has stopped grading vowels.
 */
export function stripShortVowels(str: string): string {
  // U+064B–U+0650 fathatan…kasra, U+0652 sukun, U+0670 dagger alef.
  // U+0651 (shadda) is intentionally absent from this set.
  return str.replace(/[ً-ِْٰ]/g, '');
}

/**
 * Orthographic normalization with short vowels ignored. For drills where the
 * learner is practising the consonantal skeleton and shouldn't be marked wrong
 * for skipping tashkeel.
 */
export function normalizeArabicIgnoreShortVowels(str: string): string {
  return normalizeArabicKeepVowels(stripShortVowels(str));
}

const SHORT_VOWEL_CLASS = 'ًٌٍَُِْ';
const SHADDA = 'ّ';

/**
 * The pausal (waqf) form of a fully-voweled word: everything stays, except
 * the one diacritic on the very last letter if it is a short vowel or
 * tanwin. This is how a word is said when cited on its own rather than
 * read in a sentence -- a dictionary entry or a flashcard, not a verse --
 * and it is also the standard a reader expects when a single word is
 * spoken in isolation.
 *
 * Two cases need more than a blind trailing-character strip:
 * - Tanwin fath (ً) is written on the letter *before* a word-final bare
 *   alef, not on the alef itself (كِتَابًا) -- the alef carries no mark of
 *   its own and must stay, reading as a plain long "a" once the tanwin
 *   is gone.
 * - Shadda (ّ) marks gemination, not a vowel, so it is never dropped --
 *   but whether it was typed before or after the vowel it sits with on
 *   the same letter is not guaranteed, so both orders are handled.
 */
export function pausalForm(voweled: string): string {
  const tanwinFathOnAlef = voweled.match(/ً(ا)$/);
  if (tanwinFathOnAlef) return voweled.slice(0, -2) + tanwinFathOnAlef[1];

  return voweled
    .replace(new RegExp(`([${SHADDA}])([${SHORT_VOWEL_CLASS}])$`), '$1')
    .replace(new RegExp(`([${SHORT_VOWEL_CLASS}])([${SHADDA}])$`), '$2')
    .replace(new RegExp(`[${SHORT_VOWEL_CLASS}]$`), '');
}

/**
 * Check a user's plural answer against the list of accepted answers.
 * Returns true if any normalized answer matches.
 */
export function checkPluralAnswer(userInput: string, correctAnswers: string[]): boolean {
  const userNorm = normalizeArabic(userInput);
  if (!userNorm) return false;
  return correctAnswers.some(ans => normalizeArabic(ans) === userNorm);
}
