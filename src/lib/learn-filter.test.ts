import { describe, it, expect, beforeEach } from 'vitest';
import { createCard, type FlashCard } from './spaced-repetition';
import {
  byMix, learnQueue, learnSplit, readCardMix, writeCardMix, CARD_MIX_KEY, SENTENCES_ONLY_KEY,
} from './learn-filter';

const word = (w: string): FlashCard => ({ ...createCard(w, w), wordType: 'noun' });
const sentence = (w: string): FlashCard => ({ ...createCard(w, w), wordType: 'sentence' });
const waiting = [word('بيت'), sentence('شو بدك هلق'), word('كتاب'), sentence('وين كنت')];

describe('learn filter', () => {
  beforeEach(() => localStorage.clear());

  it('opens on everything, just the sentences, or just the vocab', () => {
    expect(learnQueue(waiting, 'both')).toHaveLength(4);
    expect(learnQueue(waiting, 'sentences').map((c) => c.word)).toEqual(['شو بدك هلق', 'وين كنت']);
    expect(learnQueue(waiting, 'words').map((c) => c.word)).toEqual(['بيت', 'كتاب']);
  });

  it('treats a card with no type as vocab', () => {
    const untyped = { ...createCard('قلم', 'pen'), wordType: null };
    expect(byMix([untyped], 'words')).toEqual([untyped]);
    expect(byMix([untyped], 'sentences')).toEqual([]);
  });

  it('filters deck words the same way', () => {
    const words = [{ wordType: 'verb' }, { wordType: 'sentence' }, { wordType: null }];
    expect(byMix(words, 'sentences')).toEqual([{ wordType: 'sentence' }]);
    expect(byMix(words, 'words')).toEqual([{ wordType: 'verb' }, { wordType: null }]);
  });

  it('counts words and sentences separately', () => {
    expect(learnSplit(waiting)).toEqual({ words: 2, sentences: 2 });
  });

  it('remembers the choice on the device', () => {
    expect(readCardMix()).toBe('both');
    writeCardMix('sentences');
    expect(localStorage.getItem(CARD_MIX_KEY)).toBe('sentences');
    expect(readCardMix()).toBe('sentences');
    writeCardMix('words');
    expect(readCardMix()).toBe('words');
    writeCardMix('both');
    expect(readCardMix()).toBe('both');
  });

  it('carries over the old "sentences only" switch', () => {
    localStorage.setItem(SENTENCES_ONLY_KEY, '1');
    expect(readCardMix()).toBe('sentences');
    writeCardMix('words');
    expect(localStorage.getItem(SENTENCES_ONLY_KEY)).toBeNull();
    expect(readCardMix()).toBe('words');
  });
});
