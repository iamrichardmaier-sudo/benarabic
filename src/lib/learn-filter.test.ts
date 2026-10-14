import { describe, it, expect, beforeEach } from 'vitest';
import { createCard, type FlashCard } from './spaced-repetition';
import {
  learnQueue, learnSplit, readSentencesOnly, writeSentencesOnly, SENTENCES_ONLY_KEY,
} from './learn-filter';

const word = (w: string): FlashCard => ({ ...createCard(w, w), wordType: 'noun' });
const sentence = (w: string): FlashCard => ({ ...createCard(w, w), wordType: 'sentence' });
const waiting = [word('بيت'), sentence('شو بدك هلق'), word('كتاب'), sentence('وين كنت')];

describe('learn filter', () => {
  beforeEach(() => localStorage.clear());

  it('opens on everything unless sentences only is on', () => {
    expect(learnQueue(waiting, false)).toHaveLength(4);
    expect(learnQueue(waiting, true).map((c) => c.word)).toEqual(['شو بدك هلق', 'وين كنت']);
  });

  it('counts words and sentences separately', () => {
    expect(learnSplit(waiting)).toEqual({ words: 2, sentences: 2 });
  });

  it('remembers the choice on the device', () => {
    expect(readSentencesOnly()).toBe(false);
    writeSentencesOnly(true);
    expect(localStorage.getItem(SENTENCES_ONLY_KEY)).toBe('1');
    expect(readSentencesOnly()).toBe(true);
    writeSentencesOnly(false);
    expect(readSentencesOnly()).toBe(false);
  });
});
