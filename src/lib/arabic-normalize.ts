/**
 * Arabic text normalization for plural answer checking.
 * Strips diacritics and normalizes letter variants so users
 * are never penalized for missing tashkeel, alef variants, etc.
 */

/** Remove all tashkeel (short vowels, shadda, sukun, tanwin, etc.) */
export function stripTashkeel(str: string): string {
  return str.replace(/[\u064B-\u065F\u0670]/g, '');
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
        stripTashkeel(str)
      )
    )
  ).trim().replace(/\s+/g, ' ');
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
