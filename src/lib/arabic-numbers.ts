/**
 * Arabic numerals written out in words, agreeing with what they count.
 *
 * The hard part of Arabic numbers is not the vocabulary, it is that the
 * numeral's gender depends on the noun's — and not always the same way:
 *
 *   1–2     the numeral agrees      كِتاب واحِد  ·  مَجَلّة واحِدة
 *   3–10    the numeral reverses    ثَلاثة كُتُب  ·  ثَلاث مَجَلّات
 *   11–12   both halves agree       أَحَدَ عَشَرَ كِتاباً  ·  إِحدى عَشْرةَ مَجَلّة
 *   13–19   unit reverses, عشر agrees
 *   20–90   invariable
 *
 * Rather than encode "reverse" as a rule and get the 1–2 exception wrong, the
 * tables below are indexed by the gender of the *counted noun* directly, so
 * the polarity is baked into the data where it can be read and checked.
 */

export type Gender = 'm' | 'f';

/** The numeral as written before a masculine counted noun. */
const FOR_MASC = [
  '', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة',
  'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة',
];

/** …and before a feminine one. Note 1–2 agree while 3–10 flip. */
const FOR_FEM = [
  '', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس',
  'ست', 'سبع', 'ثمان', 'تسع', 'عشر',
];

const TENS = [
  '', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون',
  'ستون', 'سبعون', 'ثمانون', 'تسعون',
];

/** Hundreds are counted by مئة, which is feminine, so 3–9 never take a ة. */
const HUNDREDS = [
  '', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة',
  'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة',
];

const unit = (d: number, g: Gender) => (g === 'm' ? FOR_MASC : FOR_FEM)[d];

/** 1–99, the part where gender actually moves. */
function underHundred(n: number, g: Gender): string {
  if (n === 0) return '';
  if (n <= 10) return unit(n, g);

  if (n === 11) return g === 'm' ? 'أحد عشر' : 'إحدى عشرة';
  if (n === 12) return g === 'm' ? 'اثنا عشر' : 'اثنتا عشرة';
  if (n <= 19) {
    // The unit reverses as usual; عشر itself agrees with the noun.
    return `${unit(n - 10, g)} ${g === 'm' ? 'عشر' : 'عشرة'}`;
  }

  const tens = TENS[Math.floor(n / 10)];
  const ones = n % 10;
  return ones === 0 ? tens : `${unit(ones, g)} و${tens}`;
}

/** 1–999. */
function underThousand(n: number, g: Gender): string {
  const hundreds = HUNDREDS[Math.floor(n / 100)];
  const rest = underHundred(n % 100, g);
  if (!hundreds) return rest;
  return rest ? `${hundreds} و${rest}` : hundreds;
}

/**
 * `n` written out, agreeing with a counted noun of gender `g`.
 *
 * ألف and مليون are themselves masculine nouns being counted, which is why
 * the numeral in front of them is built with the masculine table regardless
 * of what is ultimately being counted: ثلاثة آلاف مَجَلّة, not ثلاث آلاف.
 */
export function numberToArabicWords(n: number, g: Gender): string {
  if (!Number.isInteger(n) || n < 1 || n > 1_000_000) {
    throw new RangeError(`Number out of range: ${n}`);
  }
  if (n === 1_000_000) return 'مليون';

  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  if (thousands === 0) return underThousand(rest, g);

  // ألف is itself a counted noun, so it takes the same forms anything else
  // does — and by its own last two digits, not by the size of the number:
  // 103,000 is مئة وثلاثة آلاف, plural, exactly as 3,000 is.
  const lastTwo = thousands % 100;
  let head: string;
  if (thousands === 1) head = 'ألف';
  else if (thousands === 2) head = 'ألفان';
  else if (lastTwo >= 3 && lastTwo <= 10) head = `${underThousand(thousands, 'm')} آلاف`;
  else head = `${underThousand(thousands, 'm')} ألف`;

  return rest === 0 ? head : `${head} و${underThousand(rest, g)}`;
}

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';

/** A number in the digits the text itself uses: 1234 → ١٢٣٤. */
export function toArabicIndic(n: number): string {
  return String(n).replace(/\d/g, (d) => ARABIC_INDIC[Number(d)]);
}
