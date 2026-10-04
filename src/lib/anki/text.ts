/**
 * Plain-text helpers shared by both directions of the Anki transfer.
 */

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

/**
 * What an Anki field says, with the markup taken off.
 *
 * Anki stores rich text, so a "back" field routinely arrives as
 * `<div>book</div><br>[sound:book.mp3]<img src="b.jpg">`. A flashcard wants
 * the words, not the wrapper: tags go, sound and image references go (their
 * files are not in a plain export and would only show as noise), entities are
 * decoded, and line breaks collapse to a single space.
 */
export function cleanField(html: string): string {
  return html
    .replace(/\[sound:[^\]]*\]/g, ' ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<\s*br\s*\/?\s*>|<\/(div|p|li)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

const ARABIC_LETTER = /[ء-ي]/;
const LATIN_LETTER = /[A-Za-z]/;

export const hasArabic = (s: string) => ARABIC_LETTER.test(s);
export const hasLatin = (s: string) => LATIN_LETTER.test(s);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
