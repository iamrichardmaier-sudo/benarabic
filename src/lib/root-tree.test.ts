import { describe, it, expect } from 'vitest';
import {
  summariseRoots, filterRoots, buildRootTree, fillPattern, rootVariants,
  verbFormRows, scriptureNotInDeck, meaningFor, type ScriptureWord,
} from './root-tree';
import type { FlashCard } from './spaced-repetition';

function card(over: Partial<FlashCard> & { id: string; word: string }): FlashCard {
  return {
    english: null,
    imageUrl: null,
    nextReviewDate: '2026-01-01',
    intervalDays: 1,
    easeFactor: 2.5,
    learningStage: 'graduated',
    stage1Attempts: 0,
    stage2Attempts: 0,
    ...over,
  } as FlashCard;
}

const deck: FlashCard[] = [
  card({ id: '1', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write', root: 'ك-ت-ب', wordType: 'verb', verbForm: 'I' }),
  card({ id: '2', word: 'كتب', wordVoweled: 'كَتَّبَ', english: 'to make write', root: 'ك-ت-ب', wordType: 'verb', verbForm: 'II' }),
  card({ id: '3', word: 'كتاب', wordVoweled: 'كِتاب', english: 'book', root: 'ك-ت-ب', wordType: 'noun' }),
  card({ id: '4', word: 'كتابة', wordVoweled: 'كِتابة', english: 'writing', root: 'ك-ت-ب', wordType: 'masdar' }),
  card({ id: '5', word: 'كاتب', wordVoweled: 'كاتِب', english: 'writer', root: 'ك-ت-ب', wordType: 'participle' }),
  card({ id: '6', word: 'أخذ', wordVoweled: 'أَخَذَ', english: 'to take', root: 'أ-خ-ذ', wordType: 'verb', verbForm: 'I' }),
  card({ id: '7', word: 'بيت', english: 'house', root: null, wordType: 'noun' }),
];

describe('summariseRoots', () => {
  it('groups cards by root, fullest family first, and skips rootless words', () => {
    const roots = summariseRoots(deck);
    expect(roots.map((r) => r.root)).toEqual(['ك-ت-ب', 'أ-خ-ذ']);
    expect(roots[0].count).toBe(5);
  });

  it('lists the verb forms held, in I–X order', () => {
    expect(summariseRoots(deck)[0].forms).toEqual(['I', 'II']);
  });

  it('merges a root written with different hamza carriers', () => {
    const roots = summariseRoots([
      ...deck,
      card({ id: '8', word: 'اخذ', english: 'taking', root: 'ا-خ-ذ', wordType: 'noun' }),
    ]);
    const take = roots.find((r) => r.key === 'اخذ');
    expect(take?.count).toBe(2);
  });
});

describe('filterRoots', () => {
  const roots = summariseRoots(deck);

  it('returns everything for an empty query', () => {
    expect(filterRoots(roots, '  ')).toHaveLength(2);
  });

  it('finds a root by typed Arabic letters, with or without dashes or vowels', () => {
    expect(filterRoots(roots, 'كتب').map((r) => r.root)).toEqual(['ك-ت-ب']);
    expect(filterRoots(roots, 'ك-ت-ب').map((r) => r.root)).toEqual(['ك-ت-ب']);
    expect(filterRoots(roots, 'كَتَب').map((r) => r.root)).toEqual(['ك-ت-ب']);
  });

  it('finds a root by the meaning of the root or the gloss of any of its words', () => {
    expect(filterRoots(roots, 'book').map((r) => r.root)).toEqual(['ك-ت-ب']);
    expect(filterRoots(roots, 'seizing', { 'أ-خ-ذ': 'seizing, taking' }).map((r) => r.root)).toEqual(['أ-خ-ذ']);
  });
});

describe('meaningFor', () => {
  it('finds a gloss however the hamza is spelled', () => {
    expect(meaningFor('ا-خ-ذ', { 'أ-خ-ذ': 'taking' })).toBe('taking');
    expect(meaningFor('ك-ت-ب', { 'أ-خ-ذ': 'taking' })).toBeNull();
  });
});

describe('rootVariants', () => {
  it('offers every hamza spelling of a hamza root', () => {
    expect(rootVariants('أ-خ-ذ').sort()).toEqual(['ا-خ-ذ', 'أ-خ-ذ', 'ء-خ-ذ'].sort());
  });

  it('leaves a plain root alone', () => {
    expect(rootVariants('ك-ت-ب')).toEqual(['ك-ت-ب']);
  });
});

describe('buildRootTree', () => {
  const tree = buildRootTree(deck, 'ك-ت-ب');

  it('counts the family and orders verbs by form', () => {
    expect(tree.total).toBe(5);
    expect(tree.verbs.map((v) => v.form)).toEqual(['I', 'II']);
  });

  it('groups the other words by class in reading order', () => {
    expect(tree.groups.map((g) => g.type)).toEqual(['masdar', 'participle', 'noun']);
    expect(tree.groups[2].words[0].ar).toBe('كِتاب');
  });

  it('puts a verb with no recorded form last, not nowhere', () => {
    const t = buildRootTree(
      [card({ id: 'x', word: 'ذهب', root: 'ذ-ه-ب', wordType: 'verb', verbForm: null })],
      'ذ-ه-ب',
    );
    expect(t.verbs).toEqual([expect.objectContaining({ form: null })]);
  });

  it('finds a hamza root whichever way the lookup spells it', () => {
    expect(buildRootTree(deck, 'ا-خ-ذ').total).toBe(1);
  });
});

describe('fillPattern', () => {
  it('pours a sound root into a pattern', () => {
    expect(fillPattern('فَعَّلَ', 'ك-ت-ب')).toBe('كَتَّبَ');
    expect(fillPattern('اِستَفعَلَ', 'ك-ت-ب')).toBe('اِستَكتَبَ');
  });

  it('declines roots whose pattern changes shape rather than print a wrong word', () => {
    expect(fillPattern('فَعَّلَ', 'ق-و-ل')).toBeNull(); // hollow
    expect(fillPattern('فَعَّلَ', 'م-د-د')).toBeNull(); // doubled
    expect(fillPattern('فَعَّلَ', 'أ-خ-ذ')).toBeNull(); // hamzated
    expect(fillPattern('فَعَّلَ', 'د-ح-ر-ج')).toBeNull(); // quadriliteral
  });
});

describe('verbFormRows', () => {
  const tree = buildRootTree(deck, 'ك-ت-ب');
  const scripture: ScriptureWord[] = [
    { lemma: 'اِكْتَتَبَ', gloss: 'to register', verbForm: 'VIII', pos: 'verb' },
    { lemma: 'كَتَبَ', gloss: 'to write', verbForm: 'I', pos: 'verb' },
  ];
  const rows = verbFormRows(tree, scripture);

  it('returns all ten forms', () => {
    expect(rows.map((r) => r.form)).toEqual(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X']);
  });

  it('marks held, scripture-only and absent forms apart', () => {
    expect(rows[0].status).toBe('deck');
    expect(rows[7].status).toBe('scripture');
    expect(rows[2].status).toBe('none');
  });

  it('does not list a word as scripture-only when the deck already holds it', () => {
    expect(rows[0].inScripture).toEqual([]);
  });
});

describe('scriptureNotInDeck', () => {
  it('drops words the learner holds, and repeats', () => {
    const tree = buildRootTree(deck, 'ك-ت-ب');
    const out = scriptureNotInDeck(tree, [
      { lemma: 'كِتاب', gloss: 'book', verbForm: null, pos: 'noun' },
      { lemma: 'مَكْتَب', gloss: 'office', verbForm: null, pos: 'noun' },
      { lemma: 'مَكتَب', gloss: 'office', verbForm: null, pos: 'noun' },
    ]);
    expect(out.map((w) => w.gloss)).toEqual(['office']);
  });
});
