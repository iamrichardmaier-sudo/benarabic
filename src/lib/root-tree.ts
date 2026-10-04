import { normalizeArabic } from './arabic-normalize';
import { rootKey, wordKey } from './word-relations';
import type { FlashCard, VerbForm, WordType } from './spaced-repetition';
import type { DictionaryEntry } from './dictionary';

/**
 * The shape of the root explorer: which roots the learner holds words on, and
 * for one root, the tree of what is built on it.
 *
 * Pure on purpose. Everything here works from the cards already in memory, so
 * the screen can open instantly and offline; the one thing that needs the
 * network (what the scripture corpus adds) is fetched separately and merged in
 * by the caller.
 */

export const VERB_FORMS: VerbForm[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export interface RootSummary {
  /** Comparison key, hamza-folded — see rootKey. */
  key: string;
  /** The spelling to show, taken from the first card that carries the root. */
  root: string;
  count: number;
  /** Verb forms the learner holds a verb in, in I–X order. */
  forms: VerbForm[];
  /** Lower-cased glosses of the root's words, so an English search finds them. */
  gloss: string;
}

/** One entry per root the deck holds a word on, the fullest family first. */
export function summariseRoots(cards: FlashCard[]): RootSummary[] {
  const byKey = new Map<string, RootSummary & { formSet: Set<VerbForm> }>();

  for (const card of cards) {
    const key = rootKey(card.root);
    if (!key || !card.root) continue;
    let entry = byKey.get(key);
    if (!entry) {
      entry = { key, root: card.root, count: 0, forms: [], gloss: '', formSet: new Set() };
      byKey.set(key, entry);
    }
    entry.count += 1;
    if (card.wordType === 'verb' && card.verbForm) entry.formSet.add(card.verbForm);
    if (card.english) entry.gloss += ` ${card.english.toLowerCase()}`;
  }

  return [...byKey.values()]
    .map(({ formSet, ...rest }) => ({ ...rest, forms: VERB_FORMS.filter((f) => formSet.has(f)) }))
    .sort((a, b) => b.count - a.count || a.root.localeCompare(b.root, 'ar'));
}

/** Roots whose letters, meaning or any word's gloss match what was typed. */
export function filterRoots(
  roots: RootSummary[],
  query: string,
  meanings: Record<string, string> = {},
): RootSummary[] {
  const q = query.trim();
  if (!q) return roots;

  if (/[؀-ۿ]/.test(q)) {
    // Typed letters, with or without the dashes and vowels.
    const needle = rootKey(normalizeArabic(q));
    return roots.filter((r) => normalizeArabic(rootKey(r.root)).includes(needle));
  }

  const needle = q.toLowerCase();
  return roots.filter(
    (r) => (meaningFor(r.root, meanings) ?? '').toLowerCase().includes(needle) || r.gloss.includes(needle),
  );
}

/** The gloss for a root, tolerant of the three ways a hamza is written. */
export function meaningFor(root: string, meanings: Record<string, string>): string | null {
  if (meanings[root]) return meanings[root];
  const key = rootKey(root);
  for (const [candidate, meaning] of Object.entries(meanings)) {
    if (rootKey(candidate) === key) return meaning;
  }
  return null;
}

/**
 * Every spelling the corpus might store a root under.
 *
 * The deck and the dictionary disagree on hamza-initial roots (أ-خ-ذ, ء-خ-ذ,
 * ا-خ-ذ are one root), so a lookup for one spelling misses the others. See
 * rootKey for why they are all the same root.
 */
export function rootVariants(root: string): string[] {
  const letters = root.split('-');
  const alternatives = letters.map((l) => (/^[ءأإآٱا]$/.test(l) ? ['أ', 'ء', 'ا'] : [l]));
  let out: string[][] = [[]];
  for (const options of alternatives) {
    out = out.flatMap((prefix) => options.map((o) => [...prefix, o]));
  }
  return [...new Set(out.map((parts) => parts.join('-')))];
}

export interface TreeWord {
  card: FlashCard;
  /** Vowelled where the card has a vowelled spelling. */
  ar: string;
  en: string;
}

export type NonVerbType = Exclude<WordType, 'verb'>;

export interface RootTree {
  root: string;
  total: number;
  /** Verb forms in I–X order, then verbs with no form recorded. */
  verbs: { form: VerbForm | null; words: TreeWord[] }[];
  /** The other word classes, in the order they read most naturally. */
  groups: { type: NonVerbType; label: string; words: TreeWord[] }[];
}

const GROUP_ORDER: { type: NonVerbType; label: string }[] = [
  { type: 'masdar', label: 'Verbal nouns' },
  { type: 'participle', label: 'Participles' },
  { type: 'noun', label: 'Nouns' },
  { type: 'adjective', label: 'Adjectives' },
  { type: 'other', label: 'Other' },
];

function treeWord(card: FlashCard): TreeWord {
  return { card, ar: card.wordVoweled || card.word, en: card.english || '' };
}

/** What is built on `root` in the learner's deck, organised as a tree. */
export function buildRootTree(cards: FlashCard[], root: string): RootTree {
  const key = rootKey(root);
  const family = cards.filter((c) => c.root && rootKey(c.root) === key);

  const verbs: RootTree['verbs'] = [];
  for (const form of [...VERB_FORMS, null] as (VerbForm | null)[]) {
    const words = family
      .filter((c) => c.wordType === 'verb' && (c.verbForm ?? null) === form)
      .map(treeWord);
    if (words.length > 0) verbs.push({ form, words });
  }

  const groups = GROUP_ORDER.map(({ type, label }) => ({
    type,
    label,
    words: family
      .filter((c) => c.wordType !== 'verb' && (c.wordType ?? 'other') === type)
      .map(treeWord),
  })).filter((g) => g.words.length > 0);

  return { root, total: family.length, verbs, groups };
}

/**
 * A verb pattern poured into a root: فَعَّلَ + ك-ت-ب → كَتَّبَ.
 *
 * Only for a sound triliteral root. A hollow, defective, hamzated or doubled
 * root changes the pattern's shape (قَوَلَ is not what Form I of ق-و-ل looks
 * like), so pouring the letters in would print a wrong word with a straight
 * face — better to say nothing than to teach a mistake. Returns null for those.
 */
export function fillPattern(pattern: string, root: string): string | null {
  const letters = root.split('-');
  if (letters.length !== 3) return null;
  if (letters.some((l) => /[ءأإآؤئٱاوىي]/.test(l))) return null;
  if (letters[1] === letters[2]) return null;

  const map: Record<string, string> = { ف: letters[0], ع: letters[1], ل: letters[2] };
  return [...pattern].map((ch) => map[ch] ?? ch).join('');
}

/** A word the scripture corpus knows on this root. */
export interface ScriptureWord {
  lemma: string;
  gloss: string | null;
  verbForm: string | null;
  pos: string | null;
}

export interface FormRow {
  form: VerbForm;
  inDeck: TreeWord[];
  inScripture: ScriptureWord[];
  /** Where this form stands for the learner: held, only met in scripture, or neither. */
  status: 'deck' | 'scripture' | 'none';
}

/** The ten forms side by side, saying which the learner holds and which the corpus attests. */
export function verbFormRows(tree: RootTree, scripture: ScriptureWord[]): FormRow[] {
  return VERB_FORMS.map((form) => {
    const inDeck = tree.verbs.find((v) => v.form === form)?.words ?? [];
    const held = new Set(inDeck.map((w) => wordKey(w.ar)));
    const inScripture = scripture.filter(
      (w) => w.verbForm === form && (w.pos === null || w.pos === 'verb') && !held.has(wordKey(w.lemma)),
    );
    return {
      form,
      inDeck,
      inScripture,
      status: inDeck.length > 0 ? 'deck' : inScripture.length > 0 ? 'scripture' : 'none',
    };
  });
}

/** Corpus words on the root that the learner does not already hold. */
export function scriptureNotInDeck(tree: RootTree, scripture: ScriptureWord[]): ScriptureWord[] {
  const held = new Set<string>();
  for (const v of tree.verbs) for (const w of v.words) held.add(wordKey(w.ar));
  for (const g of tree.groups) for (const w of g.words) held.add(wordKey(w.ar));

  const seen = new Set<string>();
  const out: ScriptureWord[] = [];
  for (const word of scripture) {
    const k = wordKey(word.lemma);
    if (!k || held.has(k) || seen.has(k)) continue;
    seen.add(k);
    out.push(word);
  }
  return out;
}

/** A dictionary row, reduced to what the explorer shows. */
export function toScriptureWord(entry: DictionaryEntry): ScriptureWord {
  return {
    lemma: entry.lemma,
    gloss: entry.glosses[0] ?? null,
    verbForm: entry.verbForm,
    pos: entry.pos,
  };
}
