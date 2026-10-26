import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * A stand-in for the three tables addDecksToLearn touches: the deck's words,
 * the learner's held cards, and the membership row. Inserts are recorded.
 */
const db = vi.hoisted(() => ({
  deckWords: [] as { words: Record<string, unknown> }[],
  held: [] as { word_id: string | null; word: string }[],
  inserted: [] as Record<string, unknown>[],
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (table: string) => ({
      upsert: async () => ({ error: null }),
      select: () => {
        const result = { data: table === 'deck_words' ? db.deckWords : db.held, error: null };
        return Object.assign(Promise.resolve(result), { eq: async () => result });
      },
      insert: async (rows: Record<string, unknown>[]) => {
        db.inserted.push(...rows);
        return { error: null };
      },
    }),
  },
}));

import { addDecksToLearn } from './deck-store';

const row = (id: string, word: string, word_type: string | null) => ({
  words: {
    id, key: id, word, word_voweled: null, english: id, root: null, word_type,
    verb_form: null, past_tense: null, present_tense: null, masdar_form: null, gender: null,
    fusha_plural: null, shaami: null, shaami_plural: null, companion_forms: null,
    example_sentence: null, example_sentence_en: null, quran_example: null,
    quran_example_en: null, quran_reference: null,
  },
});

beforeEach(() => {
  db.deckWords = [
    row('w1', 'بيت', 'noun'),
    row('w2', 'كتب', 'verb'),
    row('s1', 'شو بدك هلق', 'sentence'),
    row('s2', 'وين كنت', 'sentence'),
  ];
  db.held = [];
  db.inserted = [];
});

const added = () => db.inserted.map((r) => r.word);

describe('addDecksToLearn — vocab, sentences or both', () => {
  it('adds every word by default', async () => {
    const { newCards } = await addDecksToLearn(['d'], 'u');
    expect(newCards).toBe(4);
    expect(added()).toEqual(['بيت', 'كتب', 'شو بدك هلق', 'وين كنت']);
  });

  it('adds just the vocab', async () => {
    const { newCards } = await addDecksToLearn(['d'], 'u', 'learn', 'words');
    expect(newCards).toBe(2);
    expect(added()).toEqual(['بيت', 'كتب']);
  });

  it('adds just the sentences, and later the rest without doubling up', async () => {
    await addDecksToLearn(['d'], 'u', 'learn', 'sentences');
    expect(added()).toEqual(['شو بدك هلق', 'وين كنت']);

    db.held = db.inserted.map((r) => ({ word_id: r.word_id as string, word: r.word as string }));
    db.inserted = [];
    const { newCards } = await addDecksToLearn(['d'], 'u', 'learn', 'both');
    expect(newCards).toBe(2);
    expect(added()).toEqual(['بيت', 'كتب']);
  });
});
