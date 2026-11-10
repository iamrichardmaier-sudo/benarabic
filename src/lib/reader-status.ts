/**
 * What the learner's deck says about a word met while reading.
 *
 * The reader and the deck used to know nothing of each other: a page looked
 * the same whether every word on it was known or none was. This is the join —
 * each word of a text is known, being learned, new but on a root the learner
 * already holds, or simply new — so a page can show how much of it is within
 * reach and which new words are the cheapest to pick up.
 */
import { cardForms, cardSpellings, isFormOf, skeleton } from './cloze';
import { isIntensive } from './intensive';
import { rootKey } from './word-relations';
import type { FlashCard } from './spaced-repetition';

/**
 * 'none' is a word that is not counted either way: a particle, a name, or a
 * word nothing is recorded for and that matches no card.
 */
export type WordStatus = 'known' | 'learning' | 'root' | 'new' | 'none';

export interface DeckIndex {
  /** Skeleton of every spelling of every card. Known beats learning when a spelling is shared. */
  forms: Map<string, 'known' | 'learning'>;
  /** Roots the deck holds at least one card on. */
  roots: Set<string>;
  /** The same spellings as a list, for matching a word with a prefix and an ending. */
  list: string[];
  /** The spellings as the cards vowel them, by skeleton, to tell كُتُب from كَتَبَ. */
  voweled: Map<string, string[]>;
}

/** Through the first-week ladder and in long-term review. */
const isKnown = (c: FlashCard) => c.learningStage === 'graduated' && !isIntensive(c);

export function buildDeckIndex(cards: FlashCard[]): DeckIndex {
  const forms = new Map<string, 'known' | 'learning'>();
  const roots = new Set<string>();
  const voweled = new Map<string, string[]>();
  for (const c of cards) {
    if (c.wordType === 'sentence') continue;
    const status = isKnown(c) ? 'known' : 'learning';
    for (const f of cardForms(c)) {
      if (forms.get(f) !== 'known') forms.set(f, status);
    }
    for (const spelling of cardSpellings(c)) {
      for (const key of [skeleton(spelling), noArticle(skeleton(spelling))]) {
        voweled.set(key, [...(voweled.get(key) ?? []), spelling]);
      }
    }
    const r = rootKey(c.root);
    if (r) roots.add(r);
  }
  return { forms, roots, list: [...forms.keys()], voweled };
}

export interface ReaderWord {
  /** The word as it stands in the text. */
  surface: string;
  /** Its dictionary form, where the text is tagged. */
  lemma?: string | null;
  root?: string | null;
  pos?: string | null;
}

/** A reading from a tagged text (lib/reader-word), as statusOf wants it. */
export function wildReaderWord(
  surface: string,
  sense: { word?: string; lemma?: string; root?: string | null; wordType?: string | null; pos?: string | null } | undefined,
): ReaderWord {
  return {
    surface,
    lemma: sense ? sense.word || sense.lemma : null,
    root: sense?.root,
    pos: sense ? sense.wordType ?? sense.pos : null,
  };
}

/** Kinds of word there is nothing to learn about by adding a card. */
const UNCOUNTED = new Set(['particle', 'proper_noun']);

const noArticle = (s: string) => (s.startsWith('ال') && s.length > 4 ? s.slice(2) : s);

const SHORT_VOWELS = new Set(['\u064E', '\u064F', '\u0650']);
const MARKS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/;

/** The short vowel on each letter of a word (or none), article and final letter aside. */
function vowelSlots(word: string): (string | null)[] {
  const slots: (string | null)[] = [];
  for (const ch of word.replace(/\u0640/g, '')) {
    if (SHORT_VOWELS.has(ch)) {
      if (slots.length) slots[slots.length - 1] = ch;
    } else if (!MARKS.test(ch) && ch.trim()) {
      slots.push(null);
    }
  }
  // The article is not part of the word, and the last vowel is a case ending.
  const start = /^[\u0627\u0671][\u064E-\u0652]?\u0644/.test(word) && slots.length > 4 ? 2 : 0;
  return slots.slice(start, -1);
}

/**
 * Whether two spellings with the same letters are told apart by their vowels.
 *
 * Without this كَتَبَ in a text is "known" to a learner who holds only كُتُب.
 * Only a letter voweled differently in both counts: most text is partly
 * voweled, and a missing vowel is not a disagreement.
 */
export function vowelsDisagree(a: string, b: string): boolean {
  const x = vowelSlots(a);
  const y = vowelSlots(b);
  if (x.length !== y.length) return false;
  return x.some((v, i) => v !== null && y[i] !== null && v !== y[i]);
}

function formStatus(index: DeckIndex, word: string): 'known' | 'learning' | null {
  const key = skeleton(word);
  if (!key) return null;
  for (const k of [key, noArticle(key)]) {
    const status = index.forms.get(k);
    if (!status) continue;
    const spellings = index.voweled.get(k) ?? [];
    // Held under these letters, unless every spelling of it is voweled as a different word.
    if (spellings.length === 0 || spellings.some((s) => !vowelsDisagree(s, word))) return status;
  }
  return null;
}

export function statusOf(index: DeckIndex, word: ReaderWord): WordStatus {
  if (word.pos && UNCOUNTED.has(word.pos)) return 'none';

  // The dictionary form first: it is what a card is most likely to hold.
  const byLemma = word.lemma ? formStatus(index, word.lemma) : null;
  if (byLemma) return byLemma;
  const bySurface = formStatus(index, word.surface);
  if (bySurface) return bySurface;

  // Then the word as written, allowing for what is joined to it. Only forms
  // of three letters or more: a two-letter card (في, من) would otherwise
  // claim every word that happens to begin with it.
  const token = skeleton(word.surface);
  if (token.length >= 3) {
    const long = index.list.filter((f) => f.length >= 3);
    const hit = long.find((f) => {
      if (!isFormOf(token, [f])) return false;
      const spellings = index.voweled.get(f) ?? [];
      return spellings.length === 0 || spellings.some((s) => !vowelsDisagree(s, word.surface));
    });
    if (hit) return index.forms.get(hit)!;
  }

  const tagged = Boolean(word.lemma || word.root || word.pos);
  if (!tagged) return 'none';
  if (word.root && index.roots.has(rootKey(word.root))) return 'root';
  return 'new';
}

export interface Coverage {
  counted: number;
  known: number;
  learning: number;
  root: number;
  new: number;
  /** Share of counted words that are known or being learned, 0 to 1; null with nothing to count. */
  share: number | null;
}

/** How a text's running words split. Every occurrence counts: a common word known is a lot of the page read. */
export function coverage(statuses: WordStatus[]): Coverage {
  const c: Coverage = { counted: 0, known: 0, learning: 0, root: 0, new: 0, share: null };
  for (const s of statuses) {
    if (s === 'none') continue;
    c.counted++;
    c[s]++;
  }
  c.share = c.counted ? (c.known + c.learning) / c.counted : null;
  return c;
}

/** How each status is drawn under a word: the line's style as well as its colour, so it reads without colour. */
export const STATUS_UNDERLINE: Record<WordStatus, string> = {
  known: 'decoration-transparent',
  learning: 'decoration-dashed decoration-warning decoration-2',
  root: 'decoration-solid decoration-primary decoration-2',
  new: 'decoration-dotted decoration-muted-foreground/60 decoration-2',
  none: 'decoration-dotted decoration-muted-foreground/15',
};

export const STATUS_LABEL: Record<Exclude<WordStatus, 'none'>, string> = {
  known: 'You know this word',
  learning: 'You are learning this word',
  root: 'New word, on a root you know',
  new: 'New word',
};
