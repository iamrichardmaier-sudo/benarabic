import { describe, it, expect } from 'vitest';
import {
  nounFormFor, dualOf, normalizeAnswer, acceptedForms, isCorrect, countedForm,
} from './counted-noun';

const kitaab = { singular: 'كِتاب', plural: 'كُتُب', gender: 'm' as const };
const majalla = { singular: 'مَجَلّة', plural: 'مَجَلّات', gender: 'f' as const };

describe('nounFormFor', () => {
  it('takes the singular for one', () => {
    expect(nounFormFor(1)).toBe('singular');
  });

  it('takes the dual for two', () => {
    expect(nounFormFor(2)).toBe('dual');
  });

  it('takes the plural for three to ten', () => {
    expect(nounFormFor(3)).toBe('plural');
    expect(nounFormFor(10)).toBe('plural');
  });

  it('goes back to the singular from eleven', () => {
    // The counter-intuitive one: more than ten takes a singular noun.
    expect(nounFormFor(11)).toBe('singular');
    expect(nounFormFor(99)).toBe('singular');
  });

  it('decides by the last two digits, not by size', () => {
    expect(nounFormFor(1003)).toBe('plural');
    expect(nounFormFor(111)).toBe('singular');
    expect(nounFormFor(1_000_000)).toBe('singular');
    expect(nounFormFor(100)).toBe('singular');
  });
});

describe('dualOf', () => {
  it('opens a tāʾ marbūṭa before the ending', () => {
    expect(dualOf('مَجَلّة')).toBe('مَجَلّتان');
  });

  it('turns a final alif maqṣūra into a yāʾ', () => {
    expect(dualOf('مُستَشفى')).toBe('مُستَشفيان');
  });

  it('simply adds the ending to anything else', () => {
    expect(dualOf('كِتاب')).toBe('كِتابان');
  });
});

describe('normalizeAnswer', () => {
  it('ignores tashkeel, which this drill does not test', () => {
    expect(normalizeAnswer('كِتابان')).toBe(normalizeAnswer('كتابان'));
  });

  it('ignores how the phrase is spaced', () => {
    expect(normalizeAnswer('واحد وعشرون')).toBe(normalizeAnswer('واحد و عشرون'));
    expect(normalizeAnswer('ثلاث مئة')).toBe(normalizeAnswer('ثلاثمئة'));
  });

  it('treats مائة and مئة as the same word, because both are current', () => {
    expect(normalizeAnswer('مائة')).toBe(normalizeAnswer('مئة'));
    expect(normalizeAnswer('ثلاثمائة')).toBe(normalizeAnswer('ثلاثمئة'));
  });

  it('ignores the alif that writes tanwīn', () => {
    expect(normalizeAnswer('كتابا')).toBe(normalizeAnswer('كتاب'));
  });

  it('still tells the genders apart, which is the point', () => {
    // ة survives normalisation as ه, so ثلاثة and ثلاث stay distinct.
    expect(normalizeAnswer('ثلاثة')).not.toBe(normalizeAnswer('ثلاث'));
    expect(normalizeAnswer('واحدة')).not.toBe(normalizeAnswer('واحد'));
    expect(normalizeAnswer('اثنتان')).not.toBe(normalizeAnswer('اثنان'));
  });
});

describe('acceptedForms', () => {
  it('accepts either case of the dual, since case is not tested', () => {
    expect(isCorrect('كتابين', 'كِتابان')).toBe(true);
    expect(isCorrect('كتابان', 'كِتابان')).toBe(true);
  });

  it('accepts either case of a sound masculine plural', () => {
    expect(isCorrect('مهندسين', 'مُهَنْدِسون')).toBe(true);
  });

  it('does not accept a blank answer', () => {
    expect(isCorrect('', 'كِتاب')).toBe(false);
    expect(isCorrect('   ', 'كِتاب')).toBe(false);
  });

  it('does not accept the wrong form', () => {
    expect(isCorrect('كتب', 'كِتاب')).toBe(false);
    expect(isCorrect('ثلاث', 'ثلاثة')).toBe(false);
  });

  it('does not silently accept a near-miss on a broken plural', () => {
    expect(isCorrect('كتابات', 'كُتُب')).toBe(false);
  });
});

describe('countedForm', () => {
  it('walks a masculine noun through the shapes', () => {
    expect(countedForm(1, kitaab)).toBe('كِتاب');
    expect(countedForm(2, kitaab)).toBe('كِتابان');
    expect(countedForm(5, kitaab)).toBe('كُتُب');
    expect(countedForm(11, kitaab)).toBe('كِتاب');
    expect(countedForm(1000, kitaab)).toBe('كِتاب');
  });

  it('walks a feminine one through the same shapes', () => {
    expect(countedForm(2, majalla)).toBe('مَجَلّتان');
    expect(countedForm(7, majalla)).toBe('مَجَلّات');
    expect(countedForm(20, majalla)).toBe('مَجَلّة');
  });
});
