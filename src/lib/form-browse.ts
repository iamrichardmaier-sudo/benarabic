import type { FlashCard, VerbForm } from './spaced-repetition';

/**
 * The deck sorted by verb form, for browsing every word that is built on
 * Form II, Form X and so on. A word belongs to a form when it was tagged
 * with one: the verb itself, and also its verbal noun and participles, which
 * the tagger marks with the form they come from.
 */
export const FORMS: VerbForm[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export interface FormGroup {
  title: string;
  cards: FlashCard[];
}

/** How many of the deck's words each form holds. */
export function formCounts(cards: FlashCard[]): Record<VerbForm, number> {
  const counts = Object.fromEntries(FORMS.map((f) => [f, 0])) as Record<VerbForm, number>;
  for (const c of cards) if (c.verbForm && c.verbForm in counts) counts[c.verbForm]++;
  return counts;
}

const GROUPS: { title: string; test: (c: FlashCard) => boolean }[] = [
  { title: 'Verbs', test: (c) => c.wordType === 'verb' },
  { title: 'Verbal nouns', test: (c) => c.wordType === 'masdar' },
  { title: 'Participles', test: (c) => c.wordType === 'participle' },
  { title: 'Other words', test: () => true },
];

/** One form's words: verbs first, then verbal nouns, participles and the rest, A–Z by meaning. */
export function formGroups(cards: FlashCard[], form: VerbForm): FormGroup[] {
  const inForm = cards
    .filter((c) => c.verbForm === form)
    .sort((a, b) => (a.english ?? '').localeCompare(b.english ?? ''));
  const taken = new Set<string>();
  return GROUPS.map(({ title, test }) => {
    const group = inForm.filter((c) => !taken.has(c.id) && test(c));
    group.forEach((c) => taken.add(c.id));
    return { title, cards: group };
  }).filter((g) => g.cards.length > 0);
}
