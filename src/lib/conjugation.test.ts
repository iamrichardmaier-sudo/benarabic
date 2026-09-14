import { describe, it, expect } from 'vitest';
import { conjugate, verbClass, PEOPLE, type VerbParts } from './conjugation';

const chart = (v: VerbParts) => {
  const c = conjugate(v);
  if (!c) throw new Error('no chart');
  return c;
};

/**
 * Compares two spellings of one word.
 *
 * A shadda and the vowel sharing a letter can be typed in either order and
 * look the same on screen, so the literals in this file are normalised the
 * way `conjugate` normalises what it builds.
 */
function expectWord(actual: string, expected: string) {
  expect(actual).toBe(expected.normalize('NFC'));
}

const katab: VerbParts = { root: 'ك-ت-ب', past: 'كَتَبَ', present: 'يَكتُبُ' };
const qaal: VerbParts = { root: 'ق-و-ل', past: 'قالَ', present: 'يَقولُ' };
const baa3: VerbParts = { root: 'ب-ي-ع', past: 'باعَ', present: 'يَبيعُ' };
const naam: VerbParts = { root: 'ن-و-م', past: 'نامَ', present: 'يَنامُ' };
const masha: VerbParts = { root: 'م-ش-ي', past: 'مَشى', present: 'يَمشي' };
const da3a: VerbParts = { root: 'د-ع-و', past: 'دَعا', present: 'يَدعو' };
const marra: VerbParts = { root: 'م-ر-ر', past: 'مَرَّ', present: 'يَمُرُّ' };
const araad: VerbParts = { root: 'ر-و-د', past: 'أَرادَ', present: 'يُريدُ' };
const a3ta: VerbParts = { root: 'ع-ط-و', past: 'أَعطى', present: 'يُعطي' };
const istataa3: VerbParts = { root: 'ط-و-ع', past: 'اِستَطاعَ', present: 'يَستَطيعُ' };

describe('verbClass', () => {
  it('reads the weakness off the root, not the spelling', () => {
    // أَرادَ looks regular until a consonant suffix turns it into أَرَدْتُ.
    expect(verbClass('ر-و-د')).toBe('hollow');
    expect(verbClass('م-ش-ي')).toBe('defective');
    expect(verbClass('م-ر-ر')).toBe('doubled');
    expect(verbClass('ك-ت-ب')).toBe('sound');
  });

  it('declines a root it cannot chart', () => {
    expect(verbClass('د-ح-ر-ج')).toBeNull();
  });
});

describe('a sound verb', () => {
  const c = chart(katab);
  it('suffixes the past without touching the stem', () => {
    expectWord(c.past.ana, 'كَتَبْتُ');
    expectWord(c.past.hiya, 'كَتَبَتْ');
    expectWord(c.past.hum, 'كَتَبوا');
    expectWord(c.past.hunna, 'كَتَبْنَ');
  });

  it('swaps the prefix and suffixes the present', () => {
    expectWord(c.present.ana, 'أَكتُبُ');
    expectWord(c.present.anti, 'تَكتُبينَ');
    expectWord(c.present.hum, 'يَكتُبونَ');
    expectWord(c.present.hunna, 'يَكتُبْنَ');
  });
});

describe('a hollow verb', () => {
  it('shortens before a consonant suffix but not before a vowel', () => {
    const c = chart(qaal);
    expectWord(c.past.ana, 'قُلْتُ');
    expectWord(c.past.nahnu, 'قُلْنا');
    expectWord(c.past.hiya, 'قالَتْ');
    expectWord(c.past.hum, 'قالوا');
  });

  it('takes its short vowel from the present', () => {
    expectWord(chart(qaal).past.ana, 'قُلْتُ'); // يَقولُ → ḍamma
    expectWord(chart(baa3).past.ana, 'بِعْتُ'); // يَبيعُ → kasra
    expectWord(chart(naam).past.ana, 'نِمْتُ'); // يَنامُ → kasra
  });

  it('shortens in the present too, before the nūn of the feminine plural', () => {
    expectWord(chart(qaal).present.hunna, 'يَقُلْنَ');
    expectWord(chart(baa3).present.hunna, 'يَبِعْنَ');
    expectWord(chart(naam).present.hunna, 'يَنَمْنَ');
    // …and nowhere else.
    expectWord(chart(qaal).present.hum, 'يَقولونَ');
  });

  it('keeps the rule through the derived forms', () => {
    expectWord(chart(araad).past.ana, 'أَرَدْتُ');
    expectWord(chart(araad).present.hunna, 'يُرِدْنَ');
    expectWord(chart(istataa3).past.ana, 'اِستَطَعْتُ');
    expectWord(chart(istataa3).present.hunna, 'يَستَطِعْنَ');
  });
});

describe('a defective verb', () => {
  it('loses its final letter before a vowel ending', () => {
    const c = chart(masha);
    expectWord(c.past.hiya, 'مَشَتْ');
    expectWord(c.past.hum, 'مَشَوا');
    expectWord(c.past.huma_m, 'مَشَيا');
  });

  it('brings the weak letter back before a consonant ending', () => {
    expectWord(chart(masha).past.ana, 'مَشَيْتُ');
    expectWord(chart(da3a).past.ana, 'دَعَوْتُ'); // root wāw keeps its wāw
  });

  it('takes yāʾ in a derived form whatever the root says', () => {
    // أَعطى is on ع-ط-و, but only Form I writes that wāw: أَعطَيْتُ.
    expectWord(chart(a3ta).past.ana, 'أَعطَيْتُ');
    expectWord(chart(a3ta).past.hiya, 'أَعطَتْ');
  });

  it('absorbs the weak letter into the present endings', () => {
    const c = chart(masha);
    expectWord(c.present.hum, 'يَمشونَ');
    expectWord(c.present.anti, 'تَمشينَ');
    expectWord(c.present.hunna, 'يَمشينَ');
    expectWord(chart(da3a).present.anti, 'تَدعينَ');
  });
});

describe('a doubled verb', () => {
  const c = chart(marra);
  it('opens the gemination before a consonant suffix', () => {
    expectWord(c.past.ana, 'مَرَرْتُ');
    expectWord(c.past.hunna, 'مَرَرْنَ');
  });

  it('keeps it before a vowel', () => {
    expectWord(c.past.hiya, 'مَرَّتْ');
    expectWord(c.past.hum, 'مَرّوا');
  });

  it('opens it in the present before the feminine plural', () => {
    expectWord(c.present.hunna, 'يَمْرُرْنَ');
    expectWord(c.present.hum, 'يَمُرّونَ');
  });
});

describe('conjugate', () => {
  it('fills every person in both tenses', () => {
    const c = chart(katab);
    for (const p of PEOPLE) {
      expect(c.past[p.id], `past ${p.id}`).toBeTruthy();
      expect(c.present[p.id], `present ${p.id}`).toBeTruthy();
    }
  });

  it('keeps the stored forms for the third person masculine', () => {
    const c = chart(qaal);
    expectWord(c.past.huwa, 'قالَ');
    expectWord(c.present.huwa, 'يَقولُ');
  });

  it('returns null rather than inventing a chart it cannot vouch for', () => {
    expect(conjugate({ root: 'د-ح-r-ج', past: 'x', present: 'y' })).toBeNull();
    expect(conjugate({ root: 'ك-ت-ب', past: '', present: 'يَكتُبُ' })).toBeNull();
    // A present tense that does not begin with yāʾ is not one this can split.
    expect(conjugate({ root: 'ك-ت-ب', past: 'كَتَبَ', present: 'كتب' })).toBeNull();
  });

  it('does not mistake a doubled middle radical for a weak one', () => {
    // تَغَيَّبَ is on غ-ي-ب, but that yāʾ is a real consonant carrying a shadda,
    // not a long vowel — so nothing shortens and it suffixes like a sound verb.
    const c = chart({ root: 'غ-ي-ب', past: 'تَغَيَّبَ', present: 'يَتَغَيَّبُ' });
    expectWord(c.past.ana, 'تَغَيَّبْتُ');
    expectWord(c.present.hunna, 'يَتَغَيَّبْنَ');
  });

  it('lets the final weak letter win when a root has two', () => {
    // سَوّى is on س-و-ي. The wāw is doubled and inert; it is the yāʾ at the end
    // that shapes the paradigm.
    const c = chart({ root: 'س-و-ي', past: 'سَوّى', present: 'يُسَوّي' });
    expect(c.cls).toBe('defective');
    expectWord(c.past.ana, 'سَوَّيْتُ');
    expectWord(c.past.hiya, 'سَوَّتْ');
  });
});
