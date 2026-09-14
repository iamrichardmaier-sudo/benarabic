/**
 * The full past and present paradigm of a verb, derived from its two
 * principal parts.
 *
 * The deck stores only the third-person masculine singular of each tense, so
 * every other cell has to be built. For a sound verb that is suffixation and
 * nothing more. For the rest it is not: a third of the deck's verbs are weak,
 * and those are exactly the ones worth drilling — قالَ shortens to قُلْتُ before
 * a consonant, مَشى loses its final letter altogether in مَشَتْ, مَرَّ breaks its
 * gemination in مَرَرْتُ. A generator that suffixed blindly would teach forms
 * that do not exist.
 *
 * Each weak class is handled explicitly and tested against its paradigm.
 * Anything that does not fit a class the code knows returns null, so the drill
 * can leave that verb out rather than invent a chart for it.
 */

const FATHA = 'َ';
const DAMMA = 'ُ';
const KASRA = 'ِ';
const SUKUN = 'ْ';
const SHADDA = 'ّ';
const ALIF = 'ا';
const WAW = 'و';
const YA = 'ي';
const ALIF_MAQSURA = 'ى';
const MARKS = /[ً-ْٰ]/;

export type PersonId =
  | 'ana' | 'anta' | 'anti' | 'huwa' | 'hiya'
  | 'antuma' | 'huma_m' | 'huma_f'
  | 'nahnu' | 'antum' | 'antunna' | 'hum' | 'hunna';

export interface Person {
  id: PersonId;
  pronoun: string;
  english: string;
  /** Singular, dual or plural — the chart groups by this. */
  number: 'singular' | 'dual' | 'plural';
}

/** The order a chart is conventionally read in: first person out, then out again. */
export const PEOPLE: Person[] = [
  { id: 'ana', pronoun: 'أَنا', english: 'I', number: 'singular' },
  { id: 'anta', pronoun: 'أَنتَ', english: 'you (m.)', number: 'singular' },
  { id: 'anti', pronoun: 'أَنتِ', english: 'you (f.)', number: 'singular' },
  { id: 'huwa', pronoun: 'هُوَ', english: 'he', number: 'singular' },
  { id: 'hiya', pronoun: 'هِيَ', english: 'she', number: 'singular' },
  { id: 'antuma', pronoun: 'أَنتُما', english: 'you two', number: 'dual' },
  { id: 'huma_m', pronoun: 'هُما', english: 'they two (m.)', number: 'dual' },
  { id: 'huma_f', pronoun: 'هُما', english: 'they two (f.)', number: 'dual' },
  { id: 'nahnu', pronoun: 'نَحنُ', english: 'we', number: 'plural' },
  { id: 'antum', pronoun: 'أَنتُم', english: 'you (m. pl.)', number: 'plural' },
  { id: 'antunna', pronoun: 'أَنتُنَّ', english: 'you (f. pl.)', number: 'plural' },
  { id: 'hum', pronoun: 'هُم', english: 'they (m.)', number: 'plural' },
  { id: 'hunna', pronoun: 'هُنَّ', english: 'they (f.)', number: 'plural' },
];

export type VerbClass = 'sound' | 'hollow' | 'defective' | 'doubled';

export interface VerbParts {
  root: string;
  past: string;
  present: string;
}

export type Chart = Record<PersonId, string>;

/** Root letters, hamza carriers folded so أ and ء count as one letter. */
function radicals(root: string): string[] {
  return root.split('-').map((r) => r.trim()).filter(Boolean);
}

/**
 * Which paradigm the verb follows.
 *
 * Decided from the root rather than the spelling, because the spelling of a
 * derived form hides the weakness: أَرادَ looks regular until it meets a
 * consonant suffix and becomes أَرَدْتُ.
 */
export function verbClass(root: string): VerbClass | null {
  const r = radicals(root);
  if (r.length !== 3) return null; // quadriliterals are not charted yet
  const [, r2, r3] = r;
  if (r2 === r3) return 'doubled';
  // Defective is decided before hollow, because a root can be both: سَوّى is
  // on س-و-ي, and it is the final yāʾ that shapes it (سَوَّيْتُ), not the wāw.
  if (r3 === WAW || r3 === YA || r3 === ALIF_MAQSURA) return 'defective';
  if (r2 === WAW || r2 === YA) return 'hollow';
  return 'sound';
}

/**
 * Everything but the final short vowel — what a suffix attaches to.
 *
 * One mark, and never the shadda: مَرَّ ends shadda-then-fatha, and taking both
 * leaves مَر, which loses the gemination the doubled paradigm is built on.
 */
function trimFinalVowel(word: string): string {
  const trailing = word.match(/[ً-ْٰ]+$/);
  if (!trailing) return word;
  // Text in the wild orders the marks either way round, so the run is taken
  // whole and the shadda put back rather than trusting it to come first.
  const shadda = trailing[0].includes(SHADDA) ? SHADDA : '';
  return word.slice(0, word.length - trailing[0].length) + shadda;
}

/**
 * A geminate opened back out, for the endings that cannot carry one.
 *
 * يَمُرُّ + ‑نَ is يَمْرُرْنَ: the doubled consonant separates and the stem vowel
 * moves to sit between the two halves.
 */
function breakGemination(bare: string): string | null {
  const i = bare.lastIndexOf(SHADDA);
  if (i < 2) return null;
  const consonant = bare[i - 1];
  const hasVowel = MARKS.test(bare[i - 2] ?? '');
  const vowel = hasVowel ? bare[i - 2] : FATHA;
  const head = bare.slice(0, hasVowel ? i - 2 : i - 1);
  return head + SUKUN + consonant + vowel + consonant + SUKUN;
}

/** Consonants only — three for a Form I verb, more for every derived form. */
function letterCount(word: string): number {
  return word.replace(/[ً-ْٰ]/g, '').length;
}

/** The vowel a hollow verb shortens to, read off its present tense. */
function hollowShortVowel(present: string, derived: boolean): string {
  if (derived) return FATHA;
  if (present.includes(WAW)) return DAMMA;
  if (present.includes(YA)) return KASRA;
  return KASRA; // يَنامُ → نِمْتُ
}

/**
 * The past-tense stem a consonant suffix attaches to (‑تُ, ‑تَ, ‑نا, ‑تُم …).
 *
 * This is where the weak classes diverge and the whole exercise is worth
 * doing: قالَ → قُلْ, مَرَّ → مَرَرْ, مَشى → مَشَيْ.
 */
function pastStemBeforeConsonant(parts: VerbParts, cls: VerbClass): string | null {
  const base = trimFinalVowel(parts.past);
  const r = radicals(parts.root);

  if (cls === 'sound') return base + SUKUN;

  if (cls === 'doubled') {
    // مَرَّ is written with one رّ; before a consonant suffix the gemination
    // opens back out into two, the first carrying a fatḥa: مَرَرْتُ.
    const i = base.lastIndexOf(SHADDA);
    if (i === -1) return base + SUKUN;
    return base.slice(0, i) + FATHA + base[i - 1] + SUKUN;
  }

  if (cls === 'hollow') {
    // The long vowel disappears and the consonant before it takes a short one.
    // With no long vowel to lose, the middle radical is a real consonant and
    // not a weakness at all — Form II and V double it (تَغَيَّبَ, عُيِّنَ), and
    // those suffix like any sound verb.
    const i = base.lastIndexOf(ALIF);
    if (i === -1) return base + SUKUN;
    const derived = letterCount(base) > 3;
    return (
      base.slice(0, i).replace(/[ً-ْ]+$/, '') +
      hollowShortVowel(parts.present, derived) +
      base.slice(i + 1) +
      SUKUN
    );
  }

  // Defective. مَشى → مَشَيْ, دَعا → دَعَوْ; the فَعِلَ type (نَسِيَ) simply keeps
  // its yāʾ as a long vowel: نَسِيتُ.
  const last = base[base.length - 1];
  if (last === ALIF_MAQSURA || last === ALIF) {
    const weak = letterCount(base) === 3 && r[2] === WAW ? WAW : YA;
    return base.slice(0, -1) + FATHA + weak + SUKUN;
  }
  return base;
}

/** The present stem, with its subject prefix removed. */
function presentAfterPrefix(present: string): { prefixVowel: string; rest: string } | null {
  if (present[0] !== YA) return null;
  const prefixVowel = MARKS.test(present[1] ?? '') ? present[1] : '';
  return { prefixVowel, rest: present.slice(prefixVowel ? 2 : 1) };
}

const PRESENT_PREFIX: Record<PersonId, string> = {
  ana: 'أ', anta: 'ت', anti: 'ت', huwa: 'ي', hiya: 'ت',
  antuma: 'ت', huma_m: 'ي', huma_f: 'ت',
  nahnu: 'ن', antum: 'ت', antunna: 'ت', hum: 'ي', hunna: 'ي',
};

/** The past tense across all thirteen persons, or null if the class is unknown. */
function pastChart(parts: VerbParts, cls: VerbClass): Chart | null {
  const stem = pastStemBeforeConsonant(parts, cls);
  if (stem === null) return null;

  const base = trimFinalVowel(parts.past);
  const r = radicals(parts.root);
  const defective = cls === 'defective';
  const endsLong = base.endsWith(ALIF_MAQSURA) || base.endsWith(ALIF);

  // A vowel suffix leaves the stem alone — except on a defective verb, where
  // the final weak letter is swallowed (مَشى → مَشَتْ) or turns (مَشَوا).
  const shortened = defective && endsLong ? base.slice(0, -1) : base;
  const weak = r[2] === WAW ? WAW : YA;

  return {
    ana: stem + 'تُ',
    anta: stem + 'تَ',
    anti: stem + 'تِ',
    huwa: parts.past,
    hiya: defective && endsLong ? shortened + FATHA + 'تْ' : base + FATHA + 'تْ',
    antuma: stem + 'تُما',
    huma_m: defective && endsLong ? shortened + FATHA + weak + ALIF : base + ALIF,
    huma_f: defective && endsLong ? shortened + FATHA + 'تا' : base + FATHA + 'تا',
    nahnu: stem + 'نا',
    antum: stem + 'تُم',
    antunna: stem + 'تُنَّ',
    hum: defective && endsLong ? shortened + FATHA + WAW + ALIF : base + WAW + ALIF,
    hunna: stem + 'نَ',
  };
}

/** The present tense across all thirteen persons. */
function presentChart(parts: VerbParts, cls: VerbClass): Chart | null {
  const split = presentAfterPrefix(parts.present);
  if (!split) return null;
  const { prefixVowel, rest } = split;

  const withPrefix = (id: PersonId, body: string) =>
    PRESENT_PREFIX[id] + prefixVowel + body;

  const bare = trimFinalVowel(rest);
  const defective = cls === 'defective';
  // يَمشي ends in a long yāʾ that the plural and second-person-feminine
  // endings absorb: يَمشونَ, تَمشينَ.
  const stripWeak = defective ? bare.replace(/[يوى]$/, '') : bare;

  let hunnaBody = bare + SUKUN;
  // A hollow verb shortens before the nūn of the feminine plural: يَقُلْنَ. A
  // Form II or V verb whose middle radical merely looks weak carries a shadda
  // there instead of a long vowel, and shortens nothing: يَتَغَيَّبْنَ.
  if (cls === 'hollow' && !bare.includes(SHADDA)) {
    const i = bare.lastIndexOf(ALIF) >= 0 ? bare.lastIndexOf(ALIF)
      : Math.max(bare.lastIndexOf(WAW), bare.lastIndexOf(YA));
    if (i <= 0) return null;
    const short = bare[i] === WAW ? DAMMA : bare[i] === YA ? KASRA : FATHA;
    hunnaBody =
      bare.slice(0, i).replace(/[ً-ْ]+$/, '') + short + bare.slice(i + 1) + SUKUN;
  } else if (defective) {
    hunnaBody = stripWeak + YA;
  } else if (cls === 'doubled') {
    const broken = breakGemination(bare);
    if (!broken) return null;
    hunnaBody = broken;
  }

  return {
    ana: withPrefix('ana', rest),
    anta: withPrefix('anta', rest),
    anti: withPrefix('anti', (defective ? stripWeak : bare) + YA + 'نَ'),
    huwa: parts.present,
    hiya: withPrefix('hiya', rest),
    antuma: withPrefix('antuma', bare + ALIF + 'نِ'),
    huma_m: withPrefix('huma_m', bare + ALIF + 'نِ'),
    huma_f: withPrefix('huma_f', bare + ALIF + 'نِ'),
    nahnu: withPrefix('nahnu', rest),
    antum: withPrefix('antum', stripWeak + WAW + 'نَ'),
    antunna: withPrefix('antunna', hunnaBody + 'نَ'),
    hum: withPrefix('hum', stripWeak + WAW + 'نَ'),
    hunna: withPrefix('hunna', hunnaBody + 'نَ'),
  };
}

export interface Conjugation {
  cls: VerbClass;
  past: Chart;
  present: Chart;
}

/**
 * The whole chart, or null when the verb does not fit a paradigm this knows.
 *
 * Null is the honest answer for a quadriliteral or a form whose principal
 * parts are shaped unexpectedly: the drill drops that verb rather than showing
 * a chart it cannot vouch for.
 */
export function conjugate(parts: VerbParts): Conjugation | null {
  if (!parts.past || !parts.present || !parts.root) return null;
  const cls = verbClass(parts.root);
  if (!cls) return null;
  const past = pastChart(parts, cls);
  const present = presentChart(parts, cls);
  if (!past || !present) return null;
  // Canonical mark order. A shadda and the vowel on the same letter can be
  // typed either way round and look identical, so two spellings of one word
  // would otherwise fail to compare equal.
  return { cls, past: canonical(past), present: canonical(present) };
}

function canonical(chart: Chart): Chart {
  const out = {} as Chart;
  for (const key of Object.keys(chart) as PersonId[]) {
    out[key] = chart[key].normalize('NFC');
  }
  return out;
}
