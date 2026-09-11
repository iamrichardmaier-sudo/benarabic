import type { FlashCard } from './spaced-repetition';
import type { CountedNoun } from './counted-noun';

/**
 * The number ranges the drill offers, cut where the grammar changes rather
 * than at round figures — each box is one rule, so choosing a box chooses
 * what you are practising.
 */
export interface Range {
  id: string;
  label: string;
  hint: string;
  min: number;
  max: number;
  /**
   * Numbers are drawn in multiples of this. Only the top band uses it: above
   * ten thousand a number like 101,000 has several idiomatic readings, and a
   * drill that marks one of them wrong teaches a superstition. Multiples of a
   * thousand read only one way.
   */
  step?: number;
}

export const RANGES: Range[] = [
  { id: 'unit', label: '1–2', hint: 'Singular and dual', min: 1, max: 2 },
  { id: 'few', label: '3–10', hint: 'Plural — and the numeral flips gender', min: 3, max: 10 },
  { id: 'teens', label: '11–99', hint: 'Back to the singular', min: 11, max: 99 },
  { id: 'hundreds', label: '100–999', hint: 'مئة and its multiples', min: 100, max: 999 },
  { id: 'thousands', label: '1,000–9,999', hint: 'ألف and its multiples', min: 1000, max: 9999 },
  { id: 'large', label: '10,000–1,000,000', hint: 'Round thousands', min: 10_000, max: 1_000_000, step: 1000 },
];

/**
 * The definite article removed, since a counted noun is indefinite.
 *
 * Cards store some words with the article attached (الأَرض, اللَّحم). Dropping
 * it leaves the assimilated lām's shadda stranded on the first letter, so that
 * goes too — اللَّحم becomes لَحم rather than لَّحم. The shadda is not
 * necessarily the first mark after the letter (اللَّحم orders it fatḥa then
 * shadda), so the whole run of diacritics on that letter is searched.
 */
export function bareSingular(word: string): string {
  const trimmed = word.trim();
  if (!trimmed.startsWith('ال')) return trimmed;
  return trimmed
    .slice(2)
    .replace(/^([\u0621-\u064A])([\u064B-\u0652]*)/, (_, letter: string, marks: string) =>
      letter + marks.replace('\u0651', ''));
}

/**
 * The cards this drill can use.
 *
 * A noun needs a gender to agree with and a plural to inflect to; without
 * either there is no question to ask. Multi-word entries are left out because
 * counting an iḍāfa (اِبن عَمّ) follows rules this drill does not teach, and
 * duplicates collapse so one word cannot come up three times in a row.
 */
export interface DrillNoun extends CountedNoun {
  english: string;
  /** The card itself, so the hover panel can show everything it knows. */
  card: FlashCard;
}

export function drillableNouns(cards: FlashCard[]): DrillNoun[] {
  const seen = new Set<string>();
  const out: DrillNoun[] = [];

  for (const card of cards) {
    if (card.wordType !== 'noun') continue;
    if (card.gender !== 'm' && card.gender !== 'f') continue;
    const plural = card.fushaPlural?.trim();
    if (!plural) continue;

    const singular = bareSingular(card.wordVoweled || card.word);
    if (!singular || singular.includes(' ') || plural.includes(' ')) continue;
    if (seen.has(singular)) continue;
    seen.add(singular);

    out.push({ singular, plural, gender: card.gender, english: card.english ?? '', card });
  }
  return out;
}

/** A number from one of the chosen ranges, honouring its step. */
export function pickNumber(ranges: Range[], random: () => number = Math.random): number {
  const range = ranges[Math.floor(random() * ranges.length)];
  const step = range.step ?? 1;
  const lo = Math.ceil(range.min / step);
  const hi = Math.floor(range.max / step);
  return (lo + Math.floor(random() * (hi - lo + 1))) * step;
}
