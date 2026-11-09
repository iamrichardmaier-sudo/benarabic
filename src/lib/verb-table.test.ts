import { describe, expect, it } from 'vitest';
import {
  buildVerbTable, completeVowels, definiteMasdar, entryTable, fixHamza, participles, whichForm,
  TABLE_ORDER, type VerbEntry,
} from './verb-table';

const table = (root: string, form: string, past: string, present: string, masdar: string | null = null) => {
  const t = buildVerbTable({ root, form, past, present, masdar });
  if (!t) throw new Error(`no table for ${past}`);
  return t;
};

describe('completeVowels', () => {
  it('adds the sukun the deck leaves off, but not before a long vowel or at the end', () => {
    expect(completeVowels('اِستَأجَرَ')).toBe('اِسْتَأْجَرَ');
    expect(completeVowels('يَكتُبونَ')).toBe('يَكْتُبونَ');
    expect(completeVowels('كاتِب')).toBe('كاتِب');
  });

  it('puts a fatha before tāʾ marbūṭa', () => {
    expect(completeVowels('كِتابة')).toBe('كِتابَة');
  });
});

describe('fixHamza', () => {
  it('seats the hamza by its vowels', () => {
    expect(fixHamza('جِءْتُ')).toBe('جِئْتُ');
    expect(fixHamza('قَرَأوا')).toBe('قَرَؤوا');
    expect(fixHamza('تَقْرَأينَ')).toBe('تَقْرَئينَ');
    expect(fixHamza('أَأْكُلُ')).toBe('آكُلُ');
  });
});

describe('definiteMasdar', () => {
  it('adds ال, with a shadda on a sun letter', () => {
    expect(definiteMasdar('كِتابة')).toBe('الكِتابَة');
    expect(definiteMasdar('تَعَلُّم')).toBe('التَّعَلُّم');
    expect(definiteMasdar('الإطفاء')).toBe('الإِطْفاء');
  });

  it('turns a defective masdar’s tanween into its ي', () => {
    expect(definiteMasdar('تَوَلٍّ')).toBe('التَّوَلّي');
  });

  it('keeps only the head word of a phrase', () => {
    expect(definiteMasdar('تَعَرُّف على')).toBe('التَّعَرُّف');
  });
});

describe('the table', () => {
  it('conjugates a sound verb fully voweled, with the duals last', () => {
    const t = table('ك-ت-ب', 'I', 'كَتَبَ', 'يَكتُب', 'كِتابة');
    expect(t.present).toBe('يَكْتُبُ');
    expect(t.masdar).toBe('الكِتابَة');
    expect(t.pastChart.antum).toBe('كَتَبْتُمْ');
    expect(t.presentChart?.ana).toBe('أَكْتُبُ');
    expect(TABLE_ORDER.slice(-3)).toEqual(['antuma', 'huma_m', 'huma_f']);
  });

  it('handles hamza verbs', () => {
    const t = table('أ-خ-ذ', 'I', 'أَخَذَ', 'يَأخُذ');
    expect(t.presentChart?.ana).toBe('آخُذُ');
    expect(t.presentChart?.huwa).toBe('يَأْخُذُ');
    const j = table('ج-ي-ء', 'I', 'جاءَ', 'يَجيء');
    expect(j.pastChart.ana).toBe('جِئْتُ');
    expect(j.pastChart.hum).toBe('جاؤوا');
  });

  it('separates the defective plural from the dual, and Form II from Form I', () => {
    const d = table('د-ع-و', 'I', 'دَعا', 'يَدْعو');
    expect(d.pastChart.hum).toBe('دَعَوْا');
    expect(d.pastChart.huma_m).toBe('دَعَوا');
    const s = table('ص-ل-و', 'II', 'صَلّى', 'يُصَلّي');
    expect(s.pastChart.ana).toBe('صَلَّيْتُ');
  });

  it('assimilates ن and ت into a shadda', () => {
    expect(table('أ-م-ن', 'IV', 'آمَنَ', 'يُؤمِن').pastChart.nahnu).toBe('آمَنّا');
    expect(table('م-و-ت', 'I', 'ماتَ', 'يَموت').pastChart.antum).toBe('مُتُّمْ');
  });

  it('keeps the kasra of a فَعِلَ doubled verb, and charts Form II of a doubled root as sound', () => {
    expect(table('م-ل-ل', 'I', 'مَلَّ', 'يَمَلُّ').pastChart.ana).toBe('مَلِلْتُ');
    expect(table('ظ-ن-ن', 'I', 'ظَنَّ', 'يَظُنُّ').pastChart.ana).toBe('ظَنَنْتُ');
    expect(table('ح-د-د', 'II', 'حَدَّدَ', 'يُحَدِّد').pastChart.ana).toBe('حَدَّدْتُ');
  });

  it('writes a phrase prefix in front of every form', () => {
    const t = buildVerbTable({ root: 'ز-ي-ل', form: 'I', past: 'زالَ', present: 'يَزالُ', prefix: 'ما' });
    expect(t?.pastChart.ana).toBe('ما زِلْتُ');
  });
});

describe('participles', () => {
  it.each([
    ['ك-ت-ب', 'I', 'يَكْتُبُ', 'كاتِب', 'مَكْتوب'],
    ['ق-و-ل', 'I', 'يَقولُ', 'قائِل', 'مَقول'],
    ['ر-م-ي', 'I', 'يَرْمي', 'رامٍ', 'مَرْمِيّ'],
    ['د-ع-و', 'I', 'يَدْعو', 'داعٍ', 'مَدْعُوّ'],
    ['أ-ك-ل', 'I', 'يَأْكُلُ', 'آكِل', 'مَأْكول'],
    ['ع-ل-م', 'II', 'يُعَلِّمُ', 'مُعَلِّم', 'مُعَلَّم'],
    ['ر-و-د', 'IV', 'يُريدُ', 'مُريد', 'مُراد'],
    ['ع-ط-و', 'IV', 'يُعْطي', 'مُعْطٍ', 'مُعْطًى'],
    ['ح-ب-ب', 'IV', 'يُحِبُّ', 'مُحِبّ', 'مُحَبّ'],
    ['ط-ف-أ', 'IV', 'يُطْفِئُ', 'مُطْفِئ', 'مُطْفَأ'],
    ['ت-ر-ج-م', 'Q', 'يُتَرْجِمُ', 'مُتَرْجِم', 'مُتَرْجَم'],
  ])('%s (%s)', (root, form, present, active, passive) => {
    expect(participles({ root, form, present })).toEqual({ active, passive });
  });
});

describe('a stored entry', () => {
  const entry: VerbEntry = {
    key: 'كتب-I', root: 'ك-ت-ب', form: 'I', past: 'كَتَبَ', present: 'يَكْتُبُ', masdar: 'كِتابة',
    english: null, prefix: null, activePresent: null, activeEn: 'writer', activeExists: true,
    passiveEn: 'written', passiveExists: true, charts: null,
  };

  it('carries the participles’ English and whether they exist', () => {
    const t = entryTable({ ...entry, passiveEn: 'slept', passiveExists: false });
    expect(t?.active).toEqual({ ar: 'كاتِب', en: 'writer', exists: true });
    expect(t?.passive.exists).toBe(false);
  });

  it('takes a hand-written table and no present tense', () => {
    const t = entryTable({
      ...entry, key: 'ليس', root: 'ل-ي-س', past: 'لَيْسَ', present: '', masdar: null,
      charts: {
        past: {
          ana: 'لَسْتُ', anta: 'لَسْتَ', anti: 'لَسْتِ', huwa: 'لَيْسَ', hiya: 'لَيْسَتْ', nahnu: 'لَسْنا',
          antum: 'لَسْتُمْ', antunna: 'لَسْتُنَّ', hum: 'لَيْسوا', hunna: 'لَسْنَ', antuma: 'لَسْتُما',
          huma_m: 'لَيْسا', huma_f: 'لَيْسَتا',
        },
        present: null,
      },
    });
    expect(t?.pastChart.ana).toBe('لَسْتُ');
    expect(t?.presentChart).toBeNull();
  });

  it('finds which form the card itself is', () => {
    const t = entryTable(entry);
    if (!t) throw new Error('no table');
    expect(whichForm('كاتِب/ة', t)).toBe('active');
    expect(whichForm('مَكْتوب', t)).toBe('passive');
    expect(whichForm('الكِتابة', t)).toBe('masdar');
    expect(whichForm('كَتَبَ', t)).toBeNull();
  });
});
