/**
 * Sentence cards sit in the deck next to single words, and studying them is a
 * different kind of session: ordering words, not recognising one. This is the
 * choice of which to study — vocab, sentences, or both — for Learn and Review
 * alike, kept on the device. Adding a deck asks the same question.
 */
export type CardMix = 'both' | 'words' | 'sentences';

export const CARD_MIXES: { id: CardMix; label: string }[] = [
  { id: 'both', label: 'Both' },
  { id: 'words', label: 'Vocab' },
  { id: 'sentences', label: 'Sentences' },
];

export const CARD_MIX_KEY = 'wazn-card-mix';
/** The old on/off "sentences only" switch, read once so the choice carries over. */
export const SENTENCES_ONLY_KEY = 'wazn-learn-sentences-only';

const isMix = (v: unknown): v is CardMix => CARD_MIXES.some((m) => m.id === v);

export function readCardMix(): CardMix {
  try {
    const saved = localStorage.getItem(CARD_MIX_KEY);
    if (isMix(saved)) return saved;
    return localStorage.getItem(SENTENCES_ONLY_KEY) === '1' ? 'sentences' : 'both';
  } catch {
    return 'both';
  }
}

export function writeCardMix(mix: CardMix): void {
  try {
    if (mix === 'both') localStorage.removeItem(CARD_MIX_KEY);
    else localStorage.setItem(CARD_MIX_KEY, mix);
    localStorage.removeItem(SENTENCES_ONLY_KEY);
  } catch {
    /* a preference that cannot be saved still works for this session */
  }
}

type Typed = { wordType?: string | null };

const isSentenceType = (item: Typed) => item.wordType === 'sentence';

/** Just the vocab, just the sentences, or everything — cards and deck words alike. */
export function byMix<T extends Typed>(items: T[], mix: CardMix): T[] {
  if (mix === 'both') return items;
  return items.filter((i) => isSentenceType(i) === (mix === 'sentences'));
}

/** What Learn will open on: everything waiting, or only one kind. */
export const learnQueue = byMix;

/** How a set of cards (or deck words) splits into vocab and sentences. */
export function learnSplit(items: Typed[]): { words: number; sentences: number } {
  const sentences = items.filter(isSentenceType).length;
  return { words: items.length - sentences, sentences };
}

/** "3 words", "1 sentence" — the noun for a kind, counted. */
export function countKind(n: number, kind: 'words' | 'sentences'): string {
  const noun = kind === 'words' ? 'word' : 'sentence';
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
