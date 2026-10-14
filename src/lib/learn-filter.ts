import { isSentence, type FlashCard } from './spaced-repetition';

/**
 * Sentence cards sit in the Learn queue next to single words, and learning
 * them is a different kind of session: ordering words, not recognising one.
 * This is the choice to study just the sentences, kept on the device.
 */
export const SENTENCES_ONLY_KEY = 'wazn-learn-sentences-only';

export function readSentencesOnly(): boolean {
  try {
    return localStorage.getItem(SENTENCES_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeSentencesOnly(on: boolean): void {
  try {
    if (on) localStorage.setItem(SENTENCES_ONLY_KEY, '1');
    else localStorage.removeItem(SENTENCES_ONLY_KEY);
  } catch {
    /* a preference that cannot be saved still works for this session */
  }
}

/** What Learn will open on: everything waiting, or only the sentences. */
export function learnQueue(learnable: FlashCard[], sentencesOnly: boolean): FlashCard[] {
  return sentencesOnly ? learnable.filter(isSentence) : learnable;
}

/** How the waiting cards split, for the Learn screen's summary line. */
export function learnSplit(learnable: FlashCard[]): { words: number; sentences: number } {
  const sentences = learnable.filter(isSentence).length;
  return { words: learnable.length - sentences, sentences };
}
