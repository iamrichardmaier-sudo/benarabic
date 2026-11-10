/**
 * Fill-in-the-blank from real sentences.
 *
 * A card's example sentence has the card's word, or another word on its root,
 * taken out, and the learner picks what belongs there. The word is met inside
 * a sentence and in the form the sentence needs — with its article, its
 * ending, its attached pronoun — rather than alone in its dictionary form.
 *
 * Nothing here calls a model. Finding which word of a sentence belongs to a
 * card is done by spelling: first the card's own forms, then its root. A
 * sentence where neither can be found is left out, since a blank in the wrong
 * place teaches the wrong thing.
 */
import { normalizeArabic } from './arabic-normalize';
import type { FlashCard } from './spaced-repetition';

/** Qur'anic pause and recitation marks, which sit on a word without being part of it. */
const PAUSE_MARKS = /[\u06D6-\u06ED]/g;
/** Punctuation clinging to a word. */
const EDGE = /^[.,،؛:؟!"'«»()[\]{}\-–—…]+|[.,،؛:؟!"'«»()[\]{}\-–—…]+$/g;

/** A word as it stands in the text, without marks or punctuation around it. */
const bare = (word: string) => word.replace(PAUSE_MARKS, '').replace(EDGE, '');

/** A word as it is compared: no vowels, no pause marks, one spelling of hamza. */
export function skeleton(word: string): string {
  return normalizeArabic(word.replace(/[ۖ-ۭ]/g, '').replace(EDGE, ''))
    .replace(/[ؤئء]/g, 'ا');
}

/** What may be joined to the front of a word: و ف ب ل ك س and the article, up to four letters of it. */
const PREFIX = /^[وفبلكسا]{1,4}/;
/** Endings and attached pronouns, after normalising (ة is ه, ى is ي). */
const SUFFIX = /^(?:ه|ها|هم|هن|هما|ك|كم|كن|كما|نا|ي|ني|ا|ات|ان|ين|ون|وا|ت|تم|تن|تا|ن)?$/;

/** The separate spellings a card field can hold ("طول / طِوال", "نادي ج. نَوادي"), as written. */
function spellings(field: string | null | undefined): string[] {
  if (!field) return [];
  return field
    .split(/\s*(?:\/|،|,|ج\.)\s*/)
    .map((s) => s.trim())
    // A phrase is not one token, and a one-letter form would match anything.
    .filter((s) => skeleton(s).length >= 2 && !skeleton(s).includes(' '));
}

/** Every spelling a card's word may be met under, vowels as the card has them. */
export function cardSpellings(card: FlashCard): string[] {
  return [
    ...spellings(card.word),
    ...spellings(card.wordVoweled),
    ...spellings(card.fushaPlural),
    ...spellings(card.pastTense),
    ...spellings(card.presentTense),
    ...spellings(card.masdarForm),
  ];
}

/** The same spellings as skeletons, with and without the article, so الطلاق on a card finds طلاق in a text. */
export function cardForms(card: FlashCard): string[] {
  const all = cardSpellings(card).map(skeleton);
  return [...new Set(all.flatMap((s) => (s.startsWith('ال') && s.length > 4 ? [s, s.slice(2)] : [s])))];
}

/** True when `token` is one of `forms` with only a prefix and an ending added. */
export function isFormOf(token: string, forms: string[]): boolean {
  // Every way of taking a prefix off: وَالْكِتاب is كتاب under و + ال, and the
  // prefix letters are also ordinary letters, so each length is tried.
  const lead = token.match(PREFIX)?.[0].length ?? 0;
  const stripped = [token];
  for (let k = 1; k <= lead; k++) stripped.push(token.slice(k));
  return stripped.some((t) =>
    forms.some((f) => t.startsWith(f) && SUFFIX.test(t.slice(f.length))),
  );
}

const WEAK = new Set(['و', 'ي', 'ا']);

/**
 * A pattern for "a word built on this root": the root's letters in order,
 * with at most two pattern letters (ا و ي ت) between neighbours, a short
 * prefix before and an ending after.
 *
 * The limits are what keep it honest. Letters in order alone would find
 * ع-ل-م in عليهم; requiring that only pattern letters sit between them, and
 * only a real ending after them, does not.
 *
 * A weak root letter may show as another weak letter or not at all (ع-و-د in
 * يعيده, ه-د-ي in اهدنا), and a doubled last letter may be written once.
 * A root needs two sound letters to be searched for at all.
 */
export function rootPattern(root: string | null | undefined): RegExp | null {
  if (!root) return null;
  const letters = skeleton(root.replace(/[-\s]/g, '')).split('');
  if (letters.length < 3 || letters.length > 4) return null;
  if (letters.filter((l) => !WEAK.has(l)).length < 2) return null;
  const doubled = letters[letters.length - 1] === letters[letters.length - 2];
  const parts = letters.map((l, i) => {
    if (WEAK.has(l)) return '[اوي]?';
    if (doubled && i === letters.length - 1) return `${l}?`;
    return l;
  });
  return new RegExp(`^([وفبلكساتينم]{0,4}?)${parts.join('[اويت]{0,2}')}([اوينتهمك]{0,4})$`);
}

export interface ClozeItem {
  card: FlashCard;
  /** The sentence's words as written, vowels and all. */
  tokens: string[];
  /** Which of them is taken out. */
  blank: number;
  /** The word that belongs in the blank, without clinging punctuation. */
  answer: string;
  english: string | null;
  reference: string | null;
  /** True when the blank is the card's own word, false when it is a relative on its root. */
  exact: boolean;
}

/** Which word of `sentence` belongs to `card`, or -1. The card's own forms win over a root relative. */
export function findBlank(tokens: string[], card: FlashCard): { index: number; exact: boolean } {
  const skeletons = tokens.map(skeleton);
  const forms = cardForms(card);
  if (forms.length > 0) {
    const own = skeletons.findIndex((t) => t.length >= 2 && isFormOf(t, forms));
    if (own >= 0) return { index: own, exact: true };
  }
  const pattern = rootPattern(card.root);
  if (pattern) {
    const relative = skeletons.findIndex((t) => t.length >= 3 && pattern.test(t));
    if (relative >= 0) return { index: relative, exact: false };
  }
  return { index: -1, exact: false };
}

/** The exercise a card's example sentence makes, or null when it makes none. */
export function clozeFor(card: FlashCard): ClozeItem | null {
  const sentence = (card.quranExample || '').trim();
  if (!sentence) return null;
  const tokens = sentence.split(/\s+/).filter(Boolean);
  // One word is not a sentence, and a blank in it would be the whole of it.
  if (tokens.length < 3) return null;
  const { index, exact } = findBlank(tokens, card);
  if (index < 0) return null;
  const answer = bare(tokens[index]).trim();
  if (!answer) return null;
  return {
    card,
    tokens,
    blank: index,
    answer,
    english: card.quranExampleEn ?? null,
    reference: card.quranReference ?? null,
    exact,
  };
}

/** Every exercise the deck can make. */
export function allCloze(cards: FlashCard[]): ClozeItem[] {
  const out: ClozeItem[] = [];
  for (const c of cards) {
    const item = clozeFor(c);
    if (item) out.push(item);
  }
  return out;
}

function shuffled<T>(items: T[], random: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A session: learned words before unlearned ones, and among the learned the
 * ones the scheduler finds hardest come up most. `missed` (card ids) go first
 * of all, so yesterday's wrong answers are today's opening questions.
 */
export function clozeSession(
  items: ClozeItem[],
  count = 10,
  missed: ReadonlySet<string> = new Set(),
  random: () => number = Math.random,
): ClozeItem[] {
  const weight = (it: ClozeItem) => {
    if (missed.has(it.card.id)) return 0;
    const learned = it.card.learningStage === 'graduated';
    // Ease runs 1.3 (hard) to 2.5 (easy); a little noise so sessions differ.
    return (learned ? 1 : 3) + (it.card.easeFactor || 2.5) / 2.5 + random();
  };
  return shuffled(items, random)
    .map((it) => ({ it, w: weight(it) }))
    .sort((a, b) => a.w - b.w)
    .slice(0, count)
    .map((x) => x.it);
}

/**
 * Wrong answers for a blank: words taken out of other sentences, so every
 * option is a word in running form (article, ending and all) and the right
 * one cannot be told by looking like the only inflected word. Words on the
 * answer's own root are left out — two of them could both be defensible.
 */
export function clozeOptions(
  item: ClozeItem,
  pool: ClozeItem[],
  count = 3,
  random: () => number = Math.random,
): string[] {
  const taken = new Set([skeleton(item.answer)]);
  const root = item.card.root ? skeleton(item.card.root.replace(/[-\s]/g, '')) : null;
  const others = pool.filter((p) => {
    if (p.card.id === item.card.id) return false;
    const pr = p.card.root ? skeleton(p.card.root.replace(/[-\s]/g, '')) : null;
    return !(root && pr === root);
  });
  const sameKind = others.filter((p) => p.card.wordType === item.card.wordType);
  const out: string[] = [];
  for (const group of [shuffled(sameKind, random), shuffled(others, random)]) {
    for (const p of group) {
      if (out.length >= count) return out;
      const key = skeleton(p.answer);
      if (taken.has(key)) continue;
      taken.add(key);
      out.push(p.answer);
    }
  }
  return out;
}
