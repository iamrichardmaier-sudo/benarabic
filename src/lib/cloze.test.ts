import { describe, it, expect } from 'vitest';
import { clozeFor, clozeOptions, clozeSession, findBlank, rootPattern, allCloze } from './cloze';
import type { FlashCard } from './spaced-repetition';

let n = 0;
function card(fields: Partial<FlashCard>): FlashCard {
  return {
    id: `c${n++}`, word: '', english: null, imageUrl: null, nextReviewDate: '', intervalDays: 1,
    easeFactor: 2.5, learningStage: 'graduated', stage1Attempts: 0, stage2Attempts: 0, ...fields,
  };
}
const blankOf = (sentence: string, fields: Partial<FlashCard>) => {
  const item = clozeFor(card({ quranExample: sentence, ...fields }));
  return item ? { answer: item.answer, exact: item.exact } : null;
};

// Every case here is a card and its example as they are stored in the deck.
describe('finding the word to take out', () => {
  it("takes the card's own word, with its article and ending", () => {
    expect(blankOf('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ', { word: 'العالَم', root: 'ع-ل-م' }))
      .toEqual({ answer: 'الْعَالَمِينَ', exact: true });
    expect(blankOf('وَهُوَ الَّذِي يَبْدَأُ الْخَلْقَ ثُمَّ يُعِيدُهُ', { word: 'يُعيد', root: 'ع-و-د' }))
      .toEqual({ answer: 'يُعِيدُهُ', exact: true });
  });

  it("finds a verb by its past tense when the card leads with the present", () => {
    expect(blankOf('قَالُوا أَضْغَاثُ أَحْلَامٍ', { word: 'يقول', pastTense: 'قالَ', root: 'ق-و-ل' }))
      .toEqual({ answer: 'قَالُوا', exact: true });
  });

  it('falls back to another word on the root', () => {
    expect(blankOf('أَأَنتُمْ تَزْرَعُونَهُ أَمْ نَحْنُ الزَّارِعُونَ', { word: 'مَزرَعة', root: 'ز-ر-ع' }))
      .toEqual({ answer: 'تَزْرَعُونَهُ', exact: false });
    expect(blankOf('قَدْ سَمِعَ اللَّهُ قَوْلَ الَّتِي تُجَادِلُكَ فِي زَوْجِهَا', { word: 'يَستَمِع', root: 'س-م-ع' }))
      .toEqual({ answer: 'سَمِعَ', exact: false });
    expect(blankOf('وَمَا آمَنَ مَعَهُ إِلَّا قَلِيلٌ', { word: 'الاِستِقلال', root: 'ق-ل-ل' }))
      .toEqual({ answer: 'قَلِيلٌ', exact: false });
  });

  it('follows a weak or doubled root through its changes', () => {
    expect(blankOf('اهدِنَا الصِّراطَ المُستَقيمَ', { word: 'أَهدى', root: 'ه-د-ي' })?.answer).toBe('اهدِنَا');
    expect(blankOf('وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي', { word: 'حَلّ', root: 'ح-ل-ل' })?.answer).toBe('وَاحْلُلْ');
    expect(blankOf('كَما بَدَأَكُم تَعودونَ', { word: 'بِداية', root: 'ب-د-أ' })?.answer).toBe('بَدَأَكُم');
    expect(blankOf('إِذَا الشَّمْسُ كُوِّرَتْ', { word: 'كُرة السَّلّة', root: 'ك-و-ر' })?.answer).toBe('كُوِّرَتْ');
    expect(blankOf('قُلْ هُوَ اللَّهُ أَحَدٌ', { word: 'لا أَحَد', root: 'أ-ح-د' })?.answer).toBe('أَحَدٌ');
  });

  it('leaves out a sentence that holds no word of the card', () => {
    expect(blankOf('وَإِذ جَعَلنَا البَيتَ مَثابَةً لِلنّاسِ وَأَمنًا', { word: 'بِناية', root: 'ب-ن-ي' })).toBeNull();
    expect(blankOf('وَاجْعَل لِّي وَزِيرًا مِّنْ أَهْلِي', { word: 'رَئيس الوُزَراء', root: 'ر-أ-س' })).toBeNull();
  });

  it('does not mistake letters in order for a root', () => {
    // ع ل م are all in عليهم, in order, and it is not a word on ع-ل-م.
    const tokens = 'أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ'.split(' ');
    expect(findBlank(tokens, card({ word: 'مَعلوم', root: 'ع-ل-م' })).index).toBe(-1);
    expect(rootPattern('ق-و-ل')!.test('قلوبهم')).toBe(false);
    expect(rootPattern('ق-و-ل')!.test('قليل')).toBe(false);
  });

  it('will not search for a root with one sound letter, or blank a one-word line', () => {
    expect(rootPattern('أ-و-ن')).toBeNull();
    expect(blankOf('وَلَيَالٍ عَشْرٍ', { word: 'لَيالي', root: 'ل-ي-ل' })).toBeNull();
  });
});

describe('a session', () => {
  const deck = [
    card({ word: 'العالَم', root: 'ع-ل-م', wordType: 'noun', quranExample: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' }),
    card({ word: 'حُكومة', root: 'ح-ك-م', wordType: 'noun', quranExample: 'وَإِذَا حَكَمْتُم بَيْنَ النَّاسِ أَن تَحْكُمُوا بِالْعَدْلِ' }),
    card({ word: 'دَرَجة', root: 'د-ر-ج', wordType: 'noun', quranExample: 'وَلِكُلٍّ دَرَجَاتٌ مِّمَّا عَمِلُوا' }),
    card({ word: 'عِلم', root: 'ع-ل-م', wordType: 'noun', quranExample: 'وَفَوْقَ كُلِّ ذِي عِلْمٍ عَلِيمٌ' }),
    card({ word: 'يَقول', pastTense: 'قالَ', root: 'ق-و-ل', wordType: 'verb', quranExample: 'قَالُوا أَضْغَاثُ أَحْلَامٍ', learningStage: 'new' }),
  ];
  const items = allCloze(deck);

  it('makes an exercise of every card that has a usable sentence', () => {
    expect(items).toHaveLength(5);
  });

  it('offers wrong answers from other sentences, never from the same root', () => {
    const options = clozeOptions(items[0], items, 3, () => 0.5);
    expect(options).not.toContain(items[0].answer);
    expect(options).not.toContain('عِلْمٍ');
    expect(options.length).toBeGreaterThanOrEqual(2);
  });

  it('opens with what was missed, and puts unlearned words last', () => {
    const session = clozeSession(items, 5, new Set([deck[2].id]), () => 0.5);
    expect(session[0].card.id).toBe(deck[2].id);
    expect(session[session.length - 1].card.id).toBe(deck[4].id);
  });
});
