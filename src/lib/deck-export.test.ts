import { describe, it, expect } from 'vitest';
import type { FlashCard } from './spaced-repetition';
import {
  buildMarkdown, describeCard, exportFilename, metaLine, recentCutoff, selectCards,
} from './deck-export';
import { isoDay } from './day';

const NOW = new Date('2026-11-03T15:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const card = (over: Partial<FlashCard> & { id: string }): FlashCard => ({
  word: 'كتاب',
  english: 'book',
  imageUrl: null,
  nextReviewDate: '2026-11-04',
  intervalDays: 1,
  easeFactor: 2.5,
  learningStage: 'new',
  stage1Attempts: 0,
  stage2Attempts: 0,
  createdAt: daysAgo(1),
  ...over,
});

describe('selectCards', () => {
  const deck = [
    card({ id: 'old', createdAt: daysAgo(40) }),
    card({ id: 'edge-in', createdAt: daysAgo(13.9) }),
    card({ id: 'edge-out', createdAt: daysAgo(14.1) }),
    card({ id: 'new', createdAt: daysAgo(0.5) }),
    card({ id: 'undated', createdAt: null }),
    card({ id: 'garbled', createdAt: 'not a date' }),
  ];

  it('keeps only the last 14 days for "recent", newest first', () => {
    expect(selectCards(deck, 'recent', NOW).map((c) => c.id)).toEqual(['new', 'edge-in']);
  });

  it('never calls an undated card recent, but keeps it in the entire deck', () => {
    expect(selectCards(deck, 'recent', NOW).some((c) => c.id === 'undated')).toBe(false);
    const all = selectCards(deck, 'all', NOW).map((c) => c.id);
    expect(all).toHaveLength(6);
    expect(all.slice(0, 4)).toEqual(['new', 'edge-in', 'edge-out', 'old']);
    expect(all.slice(4).sort()).toEqual(['garbled', 'undated']);
  });

  it('does not change the order of the deck it was given', () => {
    const before = deck.map((c) => c.id);
    selectCards(deck, 'all', NOW);
    expect(deck.map((c) => c.id)).toEqual(before);
  });

  it('puts the cutoff 14 days back', () => {
    expect(recentCutoff(NOW).toISOString()).toBe('2026-10-20T15:00:00.000Z');
  });
});

describe('describeCard', () => {
  it('prefers the voweled spelling and skips what is not known', () => {
    const p = describeCard(card({ id: 'a', word: 'كتب', wordVoweled: 'كَتَبَ', english: ' to  write ', wordType: 'verb', verbForm: 'I' }));
    expect(p.arabic).toBe('كَتَبَ');
    expect(p.english).toBe('to write');
    expect(p.type).toBe('verb, form I');
    expect(p.facts).toEqual([]);
    expect(p.sentence).toBeNull();
    expect(p.quran).toBeNull();
  });

  it('fills the blank in the preposition sentence', () => {
    const p = describeCard(card({ id: 'b', fixedPreposition: 'في', prepositionSentence: 'نجح ___ الامتحان', prepositionSentenceEn: 'He passed the exam' }));
    expect(p.sentence).toEqual({ ar: 'نجح في الامتحان', en: 'He passed the exam' });
    expect(p.facts).toEqual([{ label: 'Takes', value: 'في' }]);
  });

  it('writes a one-line summary for the PDF', () => {
    const p = describeCard(card({ id: 'c', wordType: 'noun', gender: 'f', group: 'Chapter IV', learningStage: 'graduated', createdAt: '2026-10-12T10:00:00Z' }));
    expect(metaLine(p)).toContain('noun · feminine · Chapter IV · learned · added ');
  });
});

describe('buildMarkdown', () => {
  const cards = [
    card({
      id: '1', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write', wordType: 'verb', verbForm: 'I',
      root: 'ك ت ب', pastTense: 'كَتَبَ', presentTense: 'يَكْتُبُ', masdarForm: 'كِتابَة',
      quranExample: 'اقرأ باسم ربك', quranExampleEn: 'Read in the name of your Lord', quranReference: 'Al-Alaq 96:1',
    }),
    card({ id: '2', word: 'بيت', english: 'house', gender: 'm', fushaPlural: 'بُيُوت' }),
  ];
  const md = buildMarkdown(cards, { range: 'recent', count: 2, now: NOW });

  it('opens with what the file is, so a model needs no other context', () => {
    expect(md).toContain('# Arabic vocabulary (Wazn export)');
    // Days are the reader's own calendar days, so build the expectation the same way.
    expect(md).toContain(`- **Exported:** ${isoDay(NOW)}`);
    expect(md).toContain(`- **Range:** words added in the last 14 days (since ${isoDay(new Date('2026-10-20T15:00:00Z'))})`);
    expect(md).toContain('- **Words:** 2');
    expect(md).toContain('Modern Standard Arabic');
  });

  it('gives each word a heading and labelled lines', () => {
    expect(md).toContain('## 1. كَتَبَ');
    expect(md).toContain('- **English:** to write');
    expect(md).toContain('- **Type:** verb, form I');
    expect(md).toContain('- **Root:** ك ت ب');
    expect(md).toContain("- **Qur'an:** اقرأ باسم ربك (Al-Alaq 96:1)");
    expect(md).toContain('  - *Read in the name of your Lord*');
    expect(md).toContain('## 2. بيت');
    expect(md).toContain('- **Plural:** بُيُوت');
  });

  it('leaves out fields a word does not have', () => {
    const second = md.slice(md.indexOf('## 2.'));
    expect(second.includes('Root')).toBe(false);
    expect(second.includes('Qur')).toBe(false);
  });

  it('says "entire deck" for the whole deck', () => {
    expect(buildMarkdown(cards, { range: 'all', count: 2, now: NOW })).toContain('- **Range:** the entire deck');
  });
});

describe('exportFilename', () => {
  it('names the file by day, range and format', () => {
    const d = new Date(2026, 10, 3, 12);
    expect(exportFilename('recent', 'pdf', d)).toBe('wazn-words-2026-11-03-last-2-weeks.pdf');
    expect(exportFilename('all', 'markdown', d)).toBe('wazn-words-2026-11-03-entire-deck.md');
  });
});
