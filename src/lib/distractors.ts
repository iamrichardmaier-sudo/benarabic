import type { FlashCard } from './spaced-repetition';

/**
 * Wrong answers for a multiple-choice question.
 *
 * Drawn from the learner's own deck, preferring words of the same kind as the
 * right answer: a verb among verbs, a noun among nouns. Mixed kinds give the
 * answer away ("Catalan (the language)" is never the meaning of مَمْنُوع), and
 * the English for a verb starts with "to", so a lone "to …" option stands out.
 */
export function pickDistractors(
  card: FlashCard,
  pool: FlashCard[],
  field: 'word' | 'english',
  count = 3,
  random: () => number = Math.random,
): string[] {
  const correct = (card[field] || '').trim();
  const seen = new Set([correct, optionLabel(correct)]);
  const candidates = pool.filter((c) => c.id !== card.id && (c[field] || '').trim());

  const isVerbGloss = (c: FlashCard) => /^to\s/i.test(c.english || '');
  const sameKind = (c: FlashCard) =>
    card.wordType && c.wordType
      ? c.wordType === card.wordType
      : isVerbGloss(c) === isVerbGloss(card);

  const shuffle = <T,>(arr: T[]) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const out: string[] = [];
  for (const group of [candidates.filter(sameKind), candidates]) {
    for (const c of shuffle(group)) {
      if (out.length >= count) break;
      const value = (c[field] || '').trim();
      const label = optionLabel(value);
      if (seen.has(value) || seen.has(label)) continue;
      seen.add(value);
      seen.add(label);
      out.push(value);
    }
  }
  return out;
}

/**
 * How an option reads on screen. A register tag at the end ("slowly, little
 * by little (Shaami)") is dropped: the tag says which dialect the card is
 * from, which is not part of the meaning and only marks which option is odd.
 */
export function optionLabel(text: string): string {
  return text.replace(/\s*\((shaami|fusha|msa|levantine)\)\s*$/i, '').trim();
}
