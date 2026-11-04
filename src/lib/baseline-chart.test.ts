import { describe, it, expect } from 'vitest';
import { baselineChart, followsBaseline } from './baseline-chart';

describe('baselineChart', () => {
  it('builds the regular chart for each form it can', () => {
    const I = baselineChart('I')!;
    expect(I.cls).toBe('sound');
    expect(I.past.ana).toBe('فَعَلْتُ');
    expect(I.past.hiya).toBe('فَعَلَتْ');
    expect(I.present.huwa).toBe('يَفْعُلُ');
    expect(I.present.ana).toBe('أَفْعُلُ');
    expect(baselineChart('II')!.past.ana).toBe('فَعَّلْتُ');
    expect(baselineChart('X')!.present.nahnu).toBe('نَسْتَفْعِلُ');
  });

  it('has none for Form IX, which a sound root would chart wrongly, or for an unknown form', () => {
    expect(baselineChart('IX')).toBeNull();
    expect(baselineChart('XI')).toBeNull();
    expect(baselineChart(null)).toBeNull();
  });
});

describe('followsBaseline', () => {
  it('recognises a regular verb as the pattern with its own root', () => {
    expect(followsBaseline('كَتَبَ', 'ك-ت-ب', 'فَعَلَ')).toBe(true);
    // A suffix that happens to be a root letter does not confuse it.
    expect(followsBaseline('كَتَبْتُ', 'ك-ت-ب', 'فَعَلْتُ')).toBe(true);
    expect(followsBaseline('يَكْتُبُ', 'ك-ت-ب', 'يَفْعُلُ')).toBe(true);
  });

  it('sees a different stem vowel as a departure', () => {
    // جَلَسَ يَجْلِسُ: the Form I present takes kasra, not the baseline damma.
    expect(followsBaseline('يَجْلِسُ', 'ج-ل-س', 'يَفْعُلُ')).toBe(false);
    expect(followsBaseline('يَجْلِسُ', 'ج-ل-س', 'يَفْعِلُ')).toBe(true);
  });

  it('sees a weak root change as a departure', () => {
    expect(followsBaseline('قالَ', 'ق-و-ل', 'فَعَلَ')).toBe(false);
    expect(followsBaseline('قُلْتُ', 'ق-و-ل', 'فَعَلْتُ')).toBe(false);
    expect(followsBaseline('مَرَّ', 'م-ر-ر', 'فَعَلَ')).toBe(false);
    expect(followsBaseline('دَعا', 'د-ع-و', 'فَعَلَ')).toBe(false);
  });

  it('counts a weak verb as regular where it really is', () => {
    expect(followsBaseline('دَعَوْتُ', 'د-ع-و', 'فَعَلْتُ')).toBe(true);
  });

  it('handles the longer forms, including an affix that shares a root letter', () => {
    expect(followsBaseline('عَلَّمَ', 'ع-ل-م', 'فَعَّلَ')).toBe(true);
    expect(followsBaseline('يَسْتَخْرِجُ', 'خ-ر-ج', 'يَسْتَفْعِلُ')).toBe(true);
    expect(followsBaseline('يَسْتَسْفِرُ', 'س-ف-ر', 'يَسْتَفْعِلُ')).toBe(true);
    expect(followsBaseline('اِنْكَسَرَ', 'ك-س-ر', 'اِنْفَعَلَ')).toBe(true);
  });

  it('treats a hamza on any seat as the one root letter', () => {
    expect(followsBaseline('أَكَلَ', 'أ-ك-ل', 'فَعَلَ')).toBe(true);
    expect(followsBaseline('سَأَلَ', 'س-أ-ل', 'فَعَلَ')).toBe(true);
  });

  it('does not mind a missing sukun or case ending, which are often left off', () => {
    expect(followsBaseline('يَكتُب', 'ك-ت-ب', 'يَفْعُلُ')).toBe(true);
    expect(followsBaseline('يَجلِس', 'ج-ل-س', 'يَفْعُلُ')).toBe(false);
  });

  it('can compare letters and shadda only, for the masdar', () => {
    expect(followsBaseline('تَعْلِيم', 'ع-ل-م', 'تَفْعيل', { ignoreVowels: true })).toBe(true);
    expect(followsBaseline('تَعليم', 'ع-ل-م', 'تَفْعيل', { ignoreVowels: true })).toBe(true);
    expect(followsBaseline('كِتابة', 'ك-ت-ب', 'فَعْل', { ignoreVowels: true })).toBe(false);
  });

  it('is false for anything that is not a triliteral root', () => {
    expect(followsBaseline('تَرْجَمَ', 'ت-ر-ج-م', 'فَعَلَ')).toBe(false);
  });
});
