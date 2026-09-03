import { describe, it, expect } from 'vitest';
import { dialectView, hasShaami, showsShaamiRows } from './dialect';
import type { FlashCard } from './spaced-repetition';

const mk = (o: Partial<FlashCard>): FlashCard =>
  ({ id: 'x', word: 'كتب', english: 'to write', imageUrl: null, nextReviewDate: '2026-01-01',
     intervalDays: 1, easeFactor: 2.5, learningStage: 'graduated', stage1Attempts: 0,
     stage2Attempts: 0, ...o } as FlashCard);

describe('dialectView', () => {
  const withShaami = mk({ word: 'رجع', wordVoweled: 'رَجَعَ', shaami: 'رِجِع ، يرجَع عَ' });
  const withoutShaami = mk({ word: 'مجلة', wordVoweled: 'مَجَلَّة' });

  it('leads with the vowelled Fusha under msa', () => {
    expect(dialectView(withShaami, 'msa').headline).toBe('رَجَعَ');
  });

  it('leads with the vowelled Fusha under both', () => {
    expect(dialectView(withShaami, 'both').headline).toBe('رَجَعَ');
  });

  it('leads with the Shaami under shaami', () => {
    const v = dialectView(withShaami, 'shaami');
    expect(v.headline).toBe('رِجِع ، يرجَع عَ');
    expect(v.isDialectForm).toBe(true);
  });

  it('moves the displaced Fusha into the detail rather than dropping it', () => {
    expect(dialectView(withShaami, 'shaami').extraForms).toEqual([
      { label: 'Fusha', value: 'رَجَعَ' },
    ]);
  });

  it('falls back to Fusha under shaami when the card has no dialect form', () => {
    // Choosing a dialect must never shrink the deck: most words are the same
    // in both, and those cards still have to be studiable.
    const v = dialectView(withoutShaami, 'shaami');
    expect(v.headline).toBe('مَجَلَّة');
    expect(v.isDialectForm).toBe(false);
    expect(v.extraForms).toEqual([]);
  });

  it('reads aloud whatever it leads with', () => {
    expect(dialectView(withShaami, 'shaami').spoken).toBe('رِجِع ، يرجَع عَ');
    expect(dialectView(withShaami, 'msa').spoken).toBe('رَجَعَ');
  });

  it('treats a blank shaami field as absent', () => {
    expect(hasShaami(mk({ shaami: '   ' }))).toBe(false);
    expect(hasShaami(mk({ shaami: null }))).toBe(false);
  });
});

describe('showsShaamiRows', () => {
  it('hides the dialect rows only for msa', () => {
    expect(showsShaamiRows('msa')).toBe(false);
    expect(showsShaamiRows('shaami')).toBe(true);
    expect(showsShaamiRows('both')).toBe(true);
  });
});

describe('the displaced Fusha row', () => {
  const mkCard = (o: Partial<FlashCard>): FlashCard =>
    ({ id: 'x', word: 'w', english: 'e', imageUrl: null, nextReviewDate: '2026-01-01',
       intervalDays: 1, easeFactor: 2.5, learningStage: 'graduated', stage1Attempts: 0,
       stage2Attempts: 0, ...o } as FlashCard);

  it('is dropped when it would just repeat the past tense', () => {
    // A Form I verb is cited by its past tense, so "Fusha: رَجَعَ" directly
    // above "Past: رَجَعَ" reads as a bug rather than as a comparison.
    const card = mkCard({ wordVoweled: 'رَجَعَ', pastTense: 'رَجَعَ', shaami: 'رِجِع' });
    expect(dialectView(card, 'shaami').extraForms).toEqual([]);
  });

  it('is kept when the citation form differs from the past tense', () => {
    const card = mkCard({ wordVoweled: 'مَجَلَّة', shaami: 'مَجَلّة شامي' });
    expect(dialectView(card, 'shaami').extraForms).toEqual([
      { label: 'Fusha', value: 'مَجَلَّة' },
    ]);
  });
});
