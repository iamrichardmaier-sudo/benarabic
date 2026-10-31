import { describe, it, expect } from 'vitest';
import key from '../../supabase/answer-keys/2026-10-31.json';
import { checkChunks, findForm, gradeWithKey, type AnswerKey } from './answer-key';

type Sentence = AnswerKey & { position: number; reference_translations: string[] };
const [towels, paintings, sky] = key.sentences as Sentence[];

const grade = (s: Sentence, attempt: string) => gradeWithKey(s, s.reference_translations, attempt);
const rules = (s: Sentence, attempt: string) =>
  grade(s, attempt).words.filter((w) => w.status === 'fix').map((w) => w.rule);

describe('findForm', () => {
  it('matches whole words, ignoring vowels and spelling variants', () => {
    expect(findForm('اِشتَرَتْ أُختي كُلَّ', 'اشترت اختي')).toBe('اِشتَرَتْ أُختي');
    expect(findForm('في الوسط المدينة', 'وسط المدينة')).toBeNull();
    expect(findForm('ثمانمئة دولارات', 'ثمانمئة دولار')).toBeNull();
  });

  it('lets the first word carry a joined و or ف', () => {
    expect(findForm('فجدتي كانت تقول', 'جدتي كانت تقول')).toBe('فجدتي كانت تقول');
    expect(findForm('وأغلى من الزرقاء', 'أغلى من الزرقاء')).toBe('وأغلى من الزرقاء');
  });

  it('joins a و or ف typed as a separate word, and lets either side drop it', () => {
    expect(findForm('و اغلى من الزرق', 'وأغلى من الزرق')).toBe('واغلى من الزرق');
    expect(findForm('أغلى من الزرقاء', 'وأغلى من الزرقاء')).toBe('أغلى من الزرقاء');
  });

  it('keeps hamza seats apart only when asked', () => {
    expect(findForm('تقول إنها', 'تقول أنها')).not.toBeNull();
    expect(findForm('تقول إنها', 'تقول أنها', true)).toBeNull();
  });
});

describe('gradeWithKey', () => {
  it('accepts every stored correct translation and the model answer', () => {
    for (const s of [towels, paintings, sky]) {
      for (const r of [...s.reference_translations, s.model_answer]) {
        expect(checkChunks(s, r).map((c) => c.status)).toEqual(s.chunks.map(() => 'ok'));
        expect(grade(s, r).verdict).toBe('correct');
      }
    }
  });

  it('names every predicted mistake in an attempt', () => {
    const r = rules(towels, 'اشترى أختي كل المنشفة في المحل إلا الرمادي لأنهم كانوا أغمق من أرادت وأغلى من الأزرقة');
    expect(r).toHaveLength(6);
    expect(grade(towels, 'اشترى أختي كل منشفة في المحل إلا الرمادية لأنها كانت أغمق مما أرادت وأغلى من الزرقاء').verdict).toBe('minor');
  });

  it('catches a mistake that contains a correct form', () => {
    expect(rules(towels, 'اشترت أختي كل منشفة في المحل إلا الرمادية المناشف لأنها كانت أغمق مما أرادت وأغلى من الزرقاء'))
      .toEqual(['An adjective comes after its noun']);
  });

  it('catches أنّ after قال even though spelling variants are otherwise ignored', () => {
    const r = rules(sky, 'يا ترى هل تغيرت السماء حقا لأن جدتي كانت تقول أن السماء لم تعد زرقاء كما كانت في شبابها');
    expect(r).toEqual(['After قال and its forms, "that" is إنّ (hamza below)']);
  });

  it('shows valid but unexpected wording as also correct, not wrong', () => {
    const f = grade(paintings, 'باعوا اللوحات التي رسمت في وسط المدينة خلال ثلاثة أشهر بأكثر من ثمانمئة دولار لكل واحدة');
    expect(f.verdict).toBe('correct');
    expect(f.words.find((w) => w.status === 'alternative')?.part).toBe('The paintings … were sold');
  });

  it('catches short mistakes in a real, imperfect attempt', () => {
    // A dictated attempt: منتسفة and الهادي are misheard, and are left unchecked.
    const f = grade(towels, 'اختي اشتريت كل منتسفة في المحل الا الهادي لانهم اغمق من تريده و اغلى من الزرق');
    expect(f.words.filter((w) => w.status === 'fix').map((w) => w.yours)).toEqual(['اشتريت', 'لانهم', 'من تريده']);
    expect(f.words.filter((w) => w.status === 'unknown')).toHaveLength(2);
    expect(f.words.find((w) => w.part === 'and more expensive than the blue ones')?.status).toBe('ok');
  });

  it('says so when most of an attempt could not be checked', () => {
    const f = grade(towels, 'هذه جملة لا علاقة لها بالموضوع');
    expect(f.verdict).toBe('unchecked');
    expect(f.summary).toContain('doesn’t mean it’s right');
  });

  it('never marks an unrecognised part wrong', () => {
    const f = grade(sky, 'أتساءل هل تغيرت السماء حقا فجدتي كانت تقول إن السماء لم تعد زرقاء مثلما كانت في زمن شبابها');
    expect(f.verdict).toBe('unchecked');
    const unknown = f.words.filter((w) => w.status === 'unknown');
    expect(unknown).toHaveLength(1);
    expect(unknown[0].options?.length).toBeGreaterThan(0);
    expect(f.words.some((w) => w.status === 'fix')).toBe(false);
  });
});
