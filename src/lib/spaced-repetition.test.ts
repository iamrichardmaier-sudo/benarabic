import { describe, it, expect } from 'vitest';
import { parseWordLine, expandGenderVariants, acceptedAnswers, createCard } from './spaced-repetition';

describe('parseWordLine', () => {
  it('splits Fusha/Shaami on a real divider', () => {
    expect(parseWordLine('فِطِر / فَطَرَ | to eat breakfast')).toEqual([
      { fusha: 'فِطِر', shaami: 'فَطَرَ', english: 'to eat breakfast' },
    ]);
  });

  it('keeps a masc/fem "/ة" marker intact instead of splitting it', () => {
    expect(parseWordLine('مُفَضَّل/ة | favorite')).toEqual([
      { fusha: 'مُفَضَّل/ة', shaami: null, english: 'favorite' },
    ]);
  });

  it('splits a "ج." plural marker into a second entry sharing the English gloss', () => {
    expect(parseWordLine('نادي ج. نَوادي | club')).toEqual([
      { fusha: 'نادي', shaami: null, english: 'club' },
      { fusha: 'نَوادي', shaami: null, english: 'club' },
    ]);
  });

  it('returns nothing for a blank line', () => {
    expect(parseWordLine('   ')).toEqual([]);
  });

  it('treats a missing "|" as no English gloss', () => {
    expect(parseWordLine('بَاب')).toEqual([{ fusha: 'بَاب', shaami: null, english: null }]);
  });
});

describe('expandGenderVariants', () => {
  it('returns the word unchanged when there is no masc/fem marker', () => {
    expect(expandGenderVariants('كِتَاب')).toEqual(['كِتَاب']);
  });

  it('expands "/ة" into base and feminized variants', () => {
    expect(expandGenderVariants('مُفَضَّل/ة')).toEqual(['مُفَضَّل', 'مُفَضَّلة']);
  });
});

describe('acceptedAnswers', () => {
  const build = (over: Partial<ReturnType<typeof createCard>>) => ({
    ...createCard('جَبَل', 'mountain'),
    ...over,
  });

  it('accepts the singular alone when no other forms exist', () => {
    expect(acceptedAnswers(build({}))).toEqual(['جَبَل']);
  });

  it('accepts Fusha and Shaami in both singular and plural', () => {
    const card = build({ shaami: 'جبل', fushaPlural: 'جِبال', shaamiPlural: 'جبال' });
    expect(acceptedAnswers(card)).toEqual(['جَبَل', 'جبل', 'جِبال', 'جبال']);
  });

  it('expands a masc/fem marker in every form it appears in', () => {
    const card = build({ word: 'عاطِفيّ/ة', fushaPlural: 'عاطِفيّون' });
    expect(acceptedAnswers(card)).toEqual(['عاطِفيّ', 'عاطِفيّة', 'عاطِفيّون']);
  });

  it('splits a field listing several alternatives', () => {
    const card = build({ word: 'جَدّة', shaami: 'سِتّ، تيتة' });
    expect(acceptedAnswers(card)).toEqual(['جَدّة', 'سِتّ', 'تيتة']);
  });

  it('drops duplicates when Fusha and Shaami coincide', () => {
    const card = build({ word: 'بين', shaami: 'بين' });
    expect(acceptedAnswers(card)).toEqual(['بين']);
  });
});
