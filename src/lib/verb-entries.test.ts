import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => { throw new Error('no table'); } } }));

import { bundledEntryFor, hasVerbTable, participlesFor, tablesForCard } from './verb-entries';
import { createCard, type FlashCard } from '@/lib/spaced-repetition';

const card = (extra: Partial<FlashCard>): FlashCard => ({ ...createCard('w', 'x'), ...extra });

describe('the shipped verbs', () => {
  it('give a verb its participles with their English', () => {
    const p = participlesFor({ root: 'ك-ت-ب', form: 'I', past: 'كَتَبَ', present: 'يَكتُب' });
    expect(p?.active).toEqual({ ar: 'كاتِب', en: 'writer', exists: true });
    expect(p?.passive.en).toBe('written; letter');
  });

  it('match a root written with a different hamza seat', () => {
    expect(bundledEntryFor({ root: 'ج-ي-أ', form: 'I', past: 'جاءَ' })?.root).toBe('ج-ي-ء');
  });

  it('give a participle card its verb’s table, English included, without the database', async () => {
    const c = card({ word: 'مُدير', wordType: 'participle', root: 'د-و-ر' });
    expect(hasVerbTable(c)).toBe(true);
    const [t] = await tablesForCard(c);
    expect(t.highlight).toBe('active');
    expect(t.active.en).toBe('director, manager');
  });

  it('do not take a noun for a masdar it only resembles', () => {
    expect(hasVerbTable(card({ word: 'السُّفرة', wordType: 'noun', root: 'س-ف-ر' }))).toBe(false);
  });
});
