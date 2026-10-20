/**
 * Offline generator for the ten verb forms of a triliteral root.
 *
 * This runs in a script, never in the app: its output is stored in
 * `verb_conjugations` and reviewed, so the app only ever shows a stored row.
 * Each weak class (hollow, defective, assimilated, doubled) has its own
 * pattern below instead of one rule with exceptions, and anything the code is
 * unsure of (two weak letters, hamza in odd places) returns null and is left
 * for a human to write.
 *
 * Present tenses are written without the final case vowel, the way the deck
 * stores them (يُحِبّ, not يُحِبُّ).
 */

export type FormId = 'I' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII' | 'VIII' | 'IX' | 'X';
export const FORM_IDS: FormId[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export type WeakType = 'sound' | 'hollow' | 'defective' | 'assimilated' | 'doubled' | 'hamzated' | 'mixed';

export interface Paradigm {
  past: string;
  present: string;
  masdar: string;
}

const A = 'َ';
const U = 'ُ';
const I = 'ِ';
const S = 'ْ';
const SH = 'ّ';
const TANWIN_KASRA = 'ٍ';

const isWeak = (c: string) => c === 'و' || c === 'ي';
const isHamza = (c: string) => /[ءأإآؤئ]/.test(c);

export function rootLetters(root: string): string[] | null {
  const letters = root.split(/[-\s]+/).filter(Boolean);
  return letters.length === 3 ? letters : null;
}

export function classifyRoot(root: string): WeakType | null {
  const l = rootLetters(root);
  if (!l) return null;
  const [f, e, c] = l;
  const weakCount = [f, e, c].filter(isWeak).length;
  if (weakCount >= 2 || (weakCount >= 1 && l.some(isHamza))) return 'mixed';
  if (isWeak(e)) return 'hollow';
  if (isWeak(c)) return 'defective';
  if (isWeak(f)) return 'assimilated';
  if (e === c) return 'doubled';
  if (l.some(isHamza)) return 'hamzated';
  return 'sound';
}

/** The ت of Form VIII changes shape next to some first letters. */
function onsetVIII(f: string, vowel: string): string {
  if (f === 'ط' || f === 'د' || f === 'ذ') return (f === 'ذ' ? 'د' : f) + SH + vowel;
  if (f === 'ص' || f === 'ض') return f + S + 'ط' + vowel;
  if (f === 'ظ') return f + S + 'ط' + vowel;
  if (f === 'ز') return f + S + 'د' + vowel;
  if (isWeak(f) || isHamza(f)) return 'ت' + SH + vowel;
  return f + S + 'ت' + vowel;
}

/**
 * The paradigm of Forms II–X. Form I has no pattern (its vowels are lexical),
 * so it returns null and the caller supplies the attested principal parts.
 */
function build(root: string, form: FormId): Paradigm | null {
  const l = rootLetters(root);
  const kind = classifyRoot(root);
  if (!l || !kind || kind === 'mixed' || form === 'I') return null;
  const [F, E, L] = l;
  const sound = kind === 'sound' || kind === 'hamzated' || kind === 'assimilated';
  const hamzaInitial = isHamza(F);

  switch (form) {
    case 'II':
      if (kind === 'defective') {
        return { past: F + A + E + A + SH + 'ى', present: 'يُ' + F + A + E + I + SH + 'ي', masdar: 'تَ' + F + S + E + I + 'يَة' };
      }
      return { past: F + A + E + A + SH + L + A, present: 'يُ' + F + A + E + I + SH + L, masdar: 'تَ' + F + S + E + I + 'ي' + L };

    case 'III':
      if (kind === 'defective') {
        return { past: F + A + 'ا' + E + 'ى', present: 'يُ' + F + 'ا' + E + 'ي', masdar: 'مُ' + F + 'ا' + E + 'اة' };
      }
      if (kind === 'doubled') {
        return { past: F + A + 'ا' + E + SH + A, present: 'يُ' + F + 'ا' + E + SH, masdar: 'مُ' + F + 'ا' + E + A + SH + 'ة' };
      }
      return { past: F + A + 'ا' + E + A + L + A, present: 'يُ' + F + 'ا' + E + I + L, masdar: 'مُ' + F + 'ا' + E + A + L + 'ة' };

    case 'IV':
      if (hamzaInitial && kind !== 'defective') {
        return { past: 'آ' + E + A + L + A, present: 'يُؤْ' + E + I + L, masdar: 'إِي' + E + 'ا' + L };
      }
      if (kind === 'hollow') {
        return { past: 'أَ' + F + A + 'ا' + L + A, present: 'يُ' + F + I + 'ي' + L, masdar: 'إِ' + F + 'ا' + L + A + 'ة' };
      }
      if (kind === 'defective') {
        return { past: 'أَ' + F + S + E + 'ى', present: 'يُ' + F + S + E + 'ي', masdar: 'إِ' + F + S + E + 'اء' };
      }
      if (kind === 'doubled') {
        return { past: 'أَ' + F + A + E + SH + A, present: 'يُ' + F + I + E + SH, masdar: 'إِ' + F + S + E + 'ا' + L };
      }
      if (kind === 'assimilated') {
        return { past: 'أَ' + F + S + E + A + L + A, present: 'يُو' + E + I + L, masdar: 'إِي' + E + 'ا' + L };
      }
      return { past: 'أَ' + F + S + E + A + L + A, present: 'يُ' + F + S + E + I + L, masdar: 'إِ' + F + S + E + 'ا' + L };

    case 'V':
      if (kind === 'defective') {
        return { past: 'تَ' + F + A + E + A + SH + 'ى', present: 'يَتَ' + F + A + E + A + SH + 'ى', masdar: 'تَ' + F + A + E + SH + TANWIN_KASRA };
      }
      return { past: 'تَ' + F + A + E + A + SH + L + A, present: 'يَتَ' + F + A + E + A + SH + L, masdar: 'تَ' + F + A + E + U + SH + L };

    case 'VI':
      if (kind === 'defective') {
        return { past: 'تَ' + F + A + 'ا' + E + 'ى', present: 'يَتَ' + F + 'ا' + E + 'ى', masdar: 'تَ' + F + 'ا' + E + TANWIN_KASRA };
      }
      if (kind === 'doubled') {
        return { past: 'تَ' + F + A + 'ا' + E + SH + A, present: 'يَتَ' + F + 'ا' + E + SH, masdar: 'تَ' + F + 'ا' + E + U + SH };
      }
      return { past: 'تَ' + F + A + 'ا' + E + A + L + A, present: 'يَتَ' + F + 'ا' + E + A + L, masdar: 'تَ' + F + 'ا' + E + U + L };

    case 'VII':
      if (kind === 'hollow') {
        return { past: 'اِنْ' + F + 'ا' + L + A, present: 'يَنْ' + F + 'ا' + L, masdar: 'اِنْ' + F + I + 'يا' + L };
      }
      if (kind === 'defective') {
        return { past: 'اِنْ' + F + A + E + 'ى', present: 'يَنْ' + F + A + E + 'ي', masdar: 'اِنْ' + F + I + E + 'اء' };
      }
      if (kind === 'doubled') {
        return { past: 'اِنْ' + F + A + E + SH + A, present: 'يَنْ' + F + A + E + SH, masdar: 'اِنْ' + F + I + E + 'ا' + L };
      }
      return { past: 'اِنْ' + F + A + E + A + L + A, present: 'يَنْ' + F + A + E + I + L, masdar: 'اِنْ' + F + I + E + 'ا' + L };

    case 'VIII': {
      const on = (v: string) => onsetVIII(F, v);
      if (kind === 'hollow') {
        return { past: 'اِ' + on(A) + 'ا' + L + A, present: 'يَ' + on(A) + 'ا' + L, masdar: 'اِ' + on(I) + 'يا' + L };
      }
      if (kind === 'defective') {
        return { past: 'اِ' + on(A) + E + 'ى', present: 'يَ' + on(A) + E + 'ي', masdar: 'اِ' + on(I) + E + 'اء' };
      }
      if (kind === 'doubled') {
        return { past: 'اِ' + on(A) + E + SH + A, present: 'يَ' + on(A) + E + SH, masdar: 'اِ' + on(I) + E + 'ا' + L };
      }
      return { past: 'اِ' + on(A) + E + A + L + A, present: 'يَ' + on(A) + E + I + L, masdar: 'اِ' + on(I) + E + 'ا' + L };
    }

    case 'IX':
      if (!sound || kind !== 'sound') return null;
      return { past: 'اِ' + F + S + E + A + L + SH + A, present: 'يَ' + F + S + E + A + L + SH, masdar: 'اِ' + F + S + E + I + L + 'ا' + L };

    case 'X':
      if (kind === 'hollow') {
        return { past: 'اِسْتَ' + F + 'ا' + L + A, present: 'يَسْتَ' + F + 'ي' + L, masdar: 'اِسْتِ' + F + 'ا' + L + A + 'ة' };
      }
      if (kind === 'defective') {
        return { past: 'اِسْتَ' + F + S + E + 'ى', present: 'يَسْتَ' + F + S + E + 'ي', masdar: 'اِسْتِ' + F + S + E + 'اء' };
      }
      if (kind === 'doubled') {
        return { past: 'اِسْتَ' + F + A + E + SH + A, present: 'يَسْتَ' + F + I + E + SH, masdar: 'اِسْتِ' + F + S + E + 'ا' + L };
      }
      if (kind === 'assimilated') {
        return { past: 'اِسْتَ' + F + S + E + A + L + A, present: 'يَسْتَ' + F + S + E + I + L, masdar: 'اِسْتِي' + E + 'ا' + L };
      }
      return {
        past: 'اِسْتَ' + F + S + E + A + L + A,
        present: 'يَسْتَ' + F + S + E + I + L,
        masdar: 'اِسْتِ' + (hamzaInitial ? 'ئ' : F) + S + E + 'ا' + L,
      };
  }
}

const MARK = 'ً-ْٰ';

/**
 * One house style, so generated and attested strings compare equal: shadda is
 * written before the vowel it carries, and no short vowel is written on the
 * letter before a long-vowel letter (قال, not قَال; يُقيم, not يُقِيم).
 */
export function canon(text: string): string {
  return text
    .replace(/([ًٌٍَُِ])ّ/g, 'ّ$1')
    .replace(/َ(?=ا)/g, '')
    // A و or ي followed by a vowel letter is a consonant (يُواصِل, اِخْتِيار), so its vowel stays.
    .replace(new RegExp(`ِ(?=ي(?![${MARK}اىوي]))`, 'g'), '')
    .replace(new RegExp(`ُ(?=و(?![${MARK}اىوي]))`, 'g'), '');
}

export function generateForm(root: string, form: FormId): Paradigm | null {
  const p = build(root, form);
  if (!p) return null;
  // A hamza that follows يُ is written on a waw: يُؤَجِّل, not يُأَجِّل.
  let present = p.present.replace(/^يُ[أإ]/, 'يُؤ');
  let masdar = p.masdar;
  // A final hamza sits on a ya after kasra (يُفاجِئ) and on the line after alif (إِطْفاء).
  if (isHamza(rootLetters(root)![2])) {
    present = present.replace(/ِأ$/, 'ِئ');
    masdar = masdar.replace(/اأ$/, 'اء');
  }
  // Hamza right after a long alif is written on the line: تَسَاءَلَ-style, not اأ.
  const mid = (t: string) => t.replace(/اأ/g, 'اء');
  return { past: canon(mid(p.past)), present: canon(mid(present)), masdar: canon(mid(masdar)) };
}
