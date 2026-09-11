import { normalizeArabic } from './arabic-normalize';

/**
 * Which shape the counted noun takes, and what counts as typing it correctly.
 *
 * The form is decided by the number's own last two digits, never by its size:
 * 3 books and 1,003 books are both كُتُب, while 11 and 111 are both كِتاب.
 */
export type NounForm = 'singular' | 'dual' | 'plural';

export interface CountedNoun {
  /** Singular, fully vowelled, as the card stores it. */
  singular: string;
  /** Plural, fully vowelled. Without one, a noun cannot be drilled at all. */
  plural: string;
  gender: 'm' | 'f';
}

export function nounFormFor(n: number): NounForm {
  const lastTwo = n % 100;
  if (lastTwo === 1) return 'singular';
  if (lastTwo === 2) return 'dual';
  if (lastTwo >= 3 && lastTwo <= 10) return 'plural';
  return 'singular';
}

/**
 * The dual, built from the singular.
 *
 * A تاء مربوطة opens up before the ending (مَجَلّة → مَجَلّتان) and a final
 * أَلِف مَقصورة becomes a يـاء (مُستَشفى → مُستَشفَيان); everything else simply
 * takes the ending.
 */
export function dualOf(singular: string): string {
  const bare = singular.trim();
  if (/ة$/.test(bare)) return `${bare.slice(0, -1)}تان`;
  if (/[ىي]$/.test(bare)) return `${bare.slice(0, -1)}يان`;
  return `${bare}ان`;
}

/**
 * A typed answer reduced to what is actually being tested.
 *
 * Tashkeel is stripped, because the drill grades the choice of form and the
 * numeral's gender, not vowelling. Beyond that:
 *
 * - spaces go, so واحد وعشرون and واحدوعشرون and واحد و عشرون all agree;
 * - مائة folds to مئة, since both spellings are current and neither is wrong;
 * - a trailing ألف goes, because that is how tanwīn is written and tanwīn is
 *   exactly the case marking this drill has agreed not to test.
 */
export function normalizeAnswer(value: string): string {
  return normalizeArabic(value)
    .replace(/\s+/g, '')
    .replace(/مائه/g, 'مئه')
    .replace(/ا$/, '');
}

/**
 * Every spelling of `expected` that should be marked right.
 *
 * The dual and the sound masculine plural each have a nominative and an
 * oblique form — كِتابان/كِتابَين, مُهَنْدِسون/مُهَنْدِسين — and which one a counted
 * phrase wants is a matter of case. Since case is not being tested, both are
 * accepted rather than one being called wrong for a reason the drill has
 * declined to teach.
 */
export function acceptedForms(expected: string): Set<string> {
  const out = new Set<string>([normalizeAnswer(expected)]);
  const bare = expected.trim();
  if (/ان$/.test(bare)) out.add(normalizeAnswer(`${bare.slice(0, -2)}ين`));
  if (/ين$/.test(bare)) out.add(normalizeAnswer(`${bare.slice(0, -2)}ان`));
  if (/ون$/.test(bare)) out.add(normalizeAnswer(`${bare.slice(0, -2)}ين`));
  out.delete('');
  return out;
}

/** True when `given` is one of the spellings `expected` allows. */
export function isCorrect(given: string, expected: string): boolean {
  const typed = normalizeAnswer(given);
  return typed !== '' && acceptedForms(expected).has(typed);
}

/** The form of `noun` that `n` of them calls for. */
export function countedForm(n: number, noun: CountedNoun): string {
  switch (nounFormFor(n)) {
    case 'dual':
      return dualOf(noun.singular);
    case 'plural':
      return noun.plural;
    default:
      return noun.singular;
  }
}
