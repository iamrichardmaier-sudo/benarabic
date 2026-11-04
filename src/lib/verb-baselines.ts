/**
 * The baseline for each verb form: the past, the present and the verbal noun
 * (masdar) a perfectly regular root would have, written on ف-ع-ل.
 *
 * Shown beside a verb's real answers in the conjugation drill, so that where
 * the actual word departs from its wazn — a different vowel in Form I, a
 * dropped letter in a weak verb — stands out against the pattern it is
 * departing from.
 *
 * Form I is the one pattern that is not fixed: its vowels and its masdar are
 * learned verb by verb, so what is given for it is the usual model and a note
 * of the alternatives. Every other form has one regular shape.
 */

export interface BaselineCell {
  /** The pattern, fully vowelled. */
  text: string;
  /** What else is regular for this cell, in a few words. */
  note?: string;
}

export interface FormBaseline {
  past: BaselineCell;
  present: BaselineCell;
  masdar: BaselineCell;
}

export const VERB_FORM_BASELINES: Record<string, FormBaseline> = {
  I: {
    past: { text: 'فَعَلَ', note: 'also فَعِلَ and فَعُلَ' },
    present: { text: 'يَفْعُلُ', note: 'also يَفْعِلُ and يَفْعَلُ' },
    masdar: { text: 'فَعْل', note: 'varies by verb: فُعول، فِعالة، فَعَل …' },
  },
  II: {
    past: { text: 'فَعَّلَ' },
    present: { text: 'يُفَعِّلُ' },
    masdar: { text: 'تَفْعيل', note: 'تَفْعِلة when the last letter is weak' },
  },
  III: {
    past: { text: 'فاعَلَ' },
    present: { text: 'يُفاعِلُ' },
    masdar: { text: 'مُفاعَلة', note: 'or فِعال' },
  },
  IV: {
    past: { text: 'أَفْعَلَ' },
    present: { text: 'يُفْعِلُ' },
    masdar: { text: 'إِفْعال' },
  },
  V: {
    past: { text: 'تَفَعَّلَ' },
    present: { text: 'يَتَفَعَّلُ' },
    masdar: { text: 'تَفَعُّل' },
  },
  VI: {
    past: { text: 'تَفاعَلَ' },
    present: { text: 'يَتَفاعَلُ' },
    masdar: { text: 'تَفاعُل' },
  },
  VII: {
    past: { text: 'اِنْفَعَلَ' },
    present: { text: 'يَنْفَعِلُ' },
    masdar: { text: 'اِنْفِعال' },
  },
  VIII: {
    past: { text: 'اِفْتَعَلَ' },
    present: { text: 'يَفْتَعِلُ' },
    masdar: { text: 'اِفْتِعال' },
  },
  IX: {
    past: { text: 'اِفْعَلَّ' },
    present: { text: 'يَفْعَلُّ' },
    masdar: { text: 'اِفْعِلال' },
  },
  X: {
    past: { text: 'اِسْتَفْعَلَ' },
    present: { text: 'يَسْتَفْعِلُ' },
    masdar: { text: 'اِسْتِفْعال' },
  },
};

/** The baseline for a form, or null for a form this does not know. */
export function baselineFor(form: string | null | undefined): FormBaseline | null {
  return (form && VERB_FORM_BASELINES[form]) || null;
}
