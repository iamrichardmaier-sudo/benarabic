import { describe, it, expect } from 'vitest';
import { VERB_FORM_BASELINES, baselineFor } from './verb-baselines';

/** The letters of a word with every vowel mark and shadda taken off. */
const letters = (s: string) => s.replace(/[ً-ْٰ]/g, '');

/** Whether the radicals ف ع ل appear in order. */
const hasRadicalsInOrder = (s: string) => {
  const at = [...'فعل'].reduce<number[]>((acc, r) => {
    acc.push(s.indexOf(r, (acc[acc.length - 1] ?? -1) + 1));
    return acc;
  }, []);
  return at.every((i) => i >= 0);
};

describe('verb form baselines', () => {
  const forms = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

  it('covers all ten forms, and only them', () => {
    expect(Object.keys(VERB_FORM_BASELINES).sort()).toEqual([...forms].sort());
  });

  it('writes every cell on ف-ع-ل', () => {
    for (const form of forms) {
      const b = VERB_FORM_BASELINES[form];
      for (const cell of [b.past, b.present, b.masdar]) {
        expect({ form, ok: hasRadicalsInOrder(letters(cell.text)) }).toEqual({ form, ok: true });
      }
    }
  });

  it('starts every present with the third-person ي, and every past on a vowelled ف, ت, ا or أ', () => {
    for (const form of forms) {
      const b = VERB_FORM_BASELINES[form];
      expect(letters(b.present.text)[0]).toBe('ي');
      expect('فتاأ'.includes(letters(b.past.text)[0])).toBe(true);
    }
  });

  it('gives the shapes a learner would expect for the common forms', () => {
    const skeleton = (form: string) => {
      const b = VERB_FORM_BASELINES[form];
      return [letters(b.past.text), letters(b.present.text), letters(b.masdar.text)];
    };
    expect(skeleton('I')).toEqual(['فعل', 'يفعل', 'فعل']);
    expect(skeleton('II')).toEqual(['فعل', 'يفعل', 'تفعيل']);
    expect(skeleton('IV')).toEqual(['أفعل', 'يفعل', 'إفعال']);
    expect(skeleton('X')).toEqual(['استفعل', 'يستفعل', 'استفعال']);
  });

  it('marks Form I as the one whose vowels and masdar vary', () => {
    expect(VERB_FORM_BASELINES.I.present.note).toBeTruthy();
    expect(VERB_FORM_BASELINES.I.masdar.note).toBeTruthy();
  });
});

describe('baselineFor', () => {
  it('finds a form, and is null for one it does not know', () => {
    expect(baselineFor('V')?.past.text).toBe('تَفَعَّلَ');
    expect(baselineFor('XI')).toBeNull();
    expect(baselineFor(null)).toBeNull();
    expect(baselineFor(undefined)).toBeNull();
  });
});
