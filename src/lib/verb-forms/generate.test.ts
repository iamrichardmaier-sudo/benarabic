import { describe, expect, it } from 'vitest';
import { canon, classifyRoot, generateForm } from './generate';

// Fixtures are the textbook paradigms for each weak class; the six verbs
// named in the Forms spec (كتب، قال، نسي، وصل، أخذ، أحب) are covered below.
describe('classifyRoot', () => {
  it.each([
    ['ك-ت-ب', 'sound'], ['ق-و-ل', 'hollow'], ['ن-س-ي', 'defective'], ['و-ص-ل', 'assimilated'],
    ['أ-خ-ذ', 'hamzated'], ['ح-ب-ب', 'doubled'], ['و-ف-ي', 'mixed'], ['و-ق-ي', 'mixed'], ['ح-ي-ي', 'mixed'], ['ر-أ-ي', 'mixed'],
  ])('%s is %s', (root, kind) => expect(classifyRoot(root)).toBe(kind));
});

describe('generateForm', () => {
  const g = (root: string, form: Parameters<typeof generateForm>[1]) => generateForm(root, form)!;
  const c = (p: { past: string; present: string; masdar: string }) => ({ past: canon(p.past), present: canon(p.present), masdar: canon(p.masdar) });

  it('sound كتب', () => {
    expect(g('ك-ت-ب', 'II')).toEqual(c({ past: 'كَتَّبَ', present: 'يُكَتِّب', masdar: 'تَكْتِيب' }));
    expect(g('ك-ت-ب', 'III').past).toBe(canon('كَاتَبَ'));
    expect(g('ك-ت-ب', 'IV').past).toBe(canon('أَكْتَبَ'));
    expect(g('ك-ت-ب', 'VI').present).toBe(canon('يَتَكاتَب'));
    expect(g('ك-ت-ب', 'VII').past).toBe(canon('اِنْكَتَبَ'));
    expect(g('ك-ت-ب', 'VIII')).toEqual(c({ past: 'اِكْتَتَبَ', present: 'يَكْتَتِب', masdar: 'اِكْتِتاب' }));
    expect(g('ك-ت-ب', 'X')).toEqual(c({ past: 'اِسْتَكْتَبَ', present: 'يَسْتَكْتِب', masdar: 'اِسْتِكْتاب' }));
  });

  it('hollow قول (قال)', () => {
    expect(g('ق-و-ل', 'IV')).toEqual(c({ past: 'أَقالَ', present: 'يُقِيل', masdar: 'إِقالَة' }));
    expect(g('ق-و-ل', 'VII').masdar).toBe(canon('اِنْقِياد'.replace('د','ل')));
    expect(g('ق-و-ل', 'VII').past).toBe(canon('اِنْقالَ'));
    expect(g('ق-و-ل', 'VIII')).toEqual(c({ past: 'اِقْتالَ', present: 'يَقْتال', masdar: 'اِقْتِيال' }));
    expect(g('ق-و-ل', 'X').past).toBe(canon('اِسْتَقالَ'));
  });

  it('hollow فيد (اِسْتَفاد) in Form X', () => {
    expect(g('ف-ي-د', 'X')).toEqual(c({ past: 'اِسْتَفادَ', present: 'يَسْتَفِيد', masdar: 'اِسْتِفادَة' }));
  });

  it('hollow قوم (أقام) in Form IV', () => {
    expect(g('ق-و-م', 'IV')).toEqual(c({ past: 'أَقامَ', present: 'يُقِيم', masdar: 'إِقامَة' }));
  });

  it('defective نسي', () => {
    expect(g('ن-س-ي', 'II')).toEqual(c({ past: 'نَسَّى', present: 'يُنَسِّي', masdar: 'تَنْسِيَة' }));
    expect(g('ن-س-ي', 'IV')).toEqual(c({ past: 'أَنْسى', present: 'يُنْسي', masdar: 'إِنْساء' }));
    expect(g('ن-س-ي', 'V').past).toBe(canon('تَنَسَّى'));
    expect(g('ن-س-ي', 'X').past).toBe(canon('اِسْتَنْسى'));
  });

  it('assimilated وصل', () => {
    expect(g('و-ص-ل', 'III').past).toBe(canon('وَاصَلَ'));
    expect(g('و-ص-ل', 'IV')).toEqual(c({ past: 'أَوْصَلَ', present: 'يُوصِل', masdar: 'إِيصال' }));
    expect(g('و-ص-ل', 'VIII')).toEqual(c({ past: 'اِتَّصَلَ', present: 'يَتَّصِل', masdar: 'اِتِّصال' }));
    expect(g('و-ص-ل', 'X')).toEqual(c({ past: 'اِسْتَوْصَلَ', present: 'يَسْتَوْصِل', masdar: 'اِسْتِيصال' }));
  });

  it('hamzated أخذ', () => {
    expect(g('أ-خ-ذ', 'IV')).toEqual(c({ past: 'آخَذَ', present: 'يُؤْخِذ', masdar: 'إِيخاذ' }));
    expect(g('أ-خ-ذ', 'VIII')).toEqual(c({ past: 'اِتَّخَذَ', present: 'يَتَّخِذ', masdar: 'اِتِّخاذ' }));
    expect(g('أ-خ-ذ', 'V').past).toBe('أَخَّذَ'.length ? canon('تَأَخَّذَ') : '');
  });

  it('doubled حبب (أحب)', () => {
    expect(g('ح-ب-ب', 'IV')).toEqual(c({ past: 'أَحَبَّ', present: 'يُحِبّ', masdar: 'إِحْباب' }));
    expect(g('ح-ب-ب', 'VII').past).toBe(canon('اِنْحَبَّ'));
    expect(g('ح-ب-ب', 'X')).toEqual(c({ past: 'اِسْتَحَبَّ', present: 'يَسْتَحِبّ', masdar: 'اِسْتِحْباب' }));
  });

  it('Form VIII assimilation of ت', () => {
    expect(g('ص-ف-ي', 'VIII').past).toBe(canon('اِصْطَفى'));
    expect(g('ط-ل-ع', 'VIII').past).toBe(canon('اِطَّلَعَ'));
    expect(g('ز-ه-ر', 'VIII').past).toBe(canon('اِزْدَهَرَ'));
    expect(g('د-ع-ي', 'VIII').past).toBe(canon('اِدَّعى'));
    expect(g('ش-ر-ي', 'VIII').past).toBe(canon('اِشْتَرى'));
  });

  it('Form IX only for sound roots; mixed roots are left alone', () => {
    expect(g('ح-م-ر', 'IX').past).toBe(canon('اِحْمَرَّ'));
    expect(generateForm('ق-و-ل', 'IX')).toBeNull();
    expect(generateForm('ح-ي-ي', 'II')).toBeNull();
    expect(generateForm('ك-ت-ب', 'I')).toBeNull();
  });
});

describe('hamza-initial roots', () => {
  it('writes the hamza on a waw after يُ', () => {
    expect(generateForm('أ-ج-ل', 'II')!.present).toBe(canon('يُؤَجِّل'));
  });
});

describe('final and medial hamza', () => {
  it('spells the hamza where it sits', () => {
    expect(generateForm('ط-ف-أ', 'IV')!.masdar).toBe(canon('إِطْفاء'));
    expect(generateForm('ف-ج-أ', 'III')!.present).toBe(canon('يُفاجِئ'));
    expect(generateForm('ي-ق-ظ', 'IV')!.past).toBe(canon('أَيْقَظَ'));
  });
});

describe('consonantal waw and ya', () => {
  it('keeps the vowel before a و or ي that carries a long ā', () => {
    expect(generateForm('و-ص-ل', 'III')!.present).toBe('يُواصِل');
    expect(generateForm('و-ص-ل', 'III')!.masdar).toBe('مُواصَلة');
    expect(generateForm('ب-ي-ع', 'VIII')!.masdar).toBe('اِبْتِياع');
  });
});
