import { conjugate, PEOPLE, type Chart, type PersonId } from './conjugation';

/**
 * The full conjugation table shown behind the "Conjugate" button on the back
 * of a card: the definite masdar, the past and present in every person, and
 * the two participles with their English.
 *
 * Tables are worked out once and stored with the card (flashcards.verb_tables)
 * so the web app and the iOS widget show exactly the same thing, and a table
 * that needs a hand correction can be corrected in one place. This module is
 * what builds them, and what the app falls back on for a verb card whose
 * table has not been stored yet (then without the participles' English).
 */

export interface Participle {
  /** Fully voweled, indefinite: كاتِب، مَكْتوب، ماشٍ. */
  ar: string;
  /** Its English, or null when none has been written yet. */
  en: string | null;
  /** False for a form the pattern gives but the language does not use. */
  exists: boolean;
}

export interface VerbTable {
  /** The verb as it heads the table: كَتَبَ / يَكْتُبُ. */
  past: string;
  present: string;
  /** The verb's English, when it is not the card's own. */
  english?: string | null;
  /** The masdar with ال: الكِتابة. Null when the verb has none in use. */
  masdar: string | null;
  /** Written in front of every form, for a verb learned as a phrase (ما زالَ). */
  prefix?: string | null;
  pastChart: Chart;
  /** Null for a verb with no present tense (لَيْسَ). */
  presentChart: Chart | null;
  active: Participle;
  passive: Participle;
  /** Which of the forms the card itself is, so the panel can mark it. */
  highlight?: 'active' | 'passive' | 'masdar' | null;
}

/**
 * One verb as stored in verb_entries: its principal parts and the English of
 * its participles. The table itself is worked out from these by this module,
 * in the app and (from a copy of this code) in the widget alike.
 */
export interface VerbEntry {
  key: string;
  root: string;
  form: string;
  past: string;
  present: string;
  masdar: string | null;
  english: string | null;
  prefix: string | null;
  activePresent: string | null;
  activeEn: string | null;
  activeExists: boolean;
  passiveEn: string | null;
  passiveExists: boolean;
  /** Hand-written forms that replace the worked-out ones, person by person. */
  charts: { past?: Partial<Chart> | null; present?: Partial<Chart> | null } | null;
}

/**
 * The order the table is read in: singular, then plural, then the dual at the
 * bottom (rarer, and kept out of the way).
 */
export const TABLE_ORDER: PersonId[] = [
  'ana', 'anta', 'anti', 'huwa', 'hiya',
  'nahnu', 'antum', 'antunna', 'hum', 'hunna',
  'antuma', 'huma_m', 'huma_f',
];

export const PRONOUN: Record<PersonId, string> = Object.fromEntries(
  PEOPLE.map((p) => [p.id, p.pronoun]),
) as Record<PersonId, string>;

export const DUAL: ReadonlySet<PersonId> = new Set(['antuma', 'huma_m', 'huma_f']);

// -- Letters and marks ---------------------------------------------------------

const FATHA = 'َ';
const DAMMA = 'ُ';
const KASRA = 'ِ';
const SUKUN = 'ْ';
const SHADDA = 'ّ';
const FATHATAN = 'ً';
const KASRATAN = 'ٍ';
const DAMMATAN = 'ٌ';
const MARK_RE = /[ً-ْٰ]/;
const VOWELS = [FATHA, DAMMA, KASRA];
const HAMZAS = 'أإؤئء';
const SUN = new Set('تثدذرزسشصضطظلن');

const isMark = (c: string | undefined) => !!c && MARK_RE.test(c);
const isLetter = (c: string | undefined) => !!c && /[ء-يٱ]/.test(c) && !isMark(c);

interface Glyph { ch: string; marks: string }

function split(word: string): Glyph[] {
  const out: Glyph[] = [];
  for (const c of word) {
    if (isMark(c) && out.length) out[out.length - 1].marks += c;
    else out.push({ ch: c, marks: '' });
  }
  return out;
}

const join = (gs: Glyph[]) => gs.map((g) => g.ch + order(g.marks)).join('');

/** Shadda before the vowel it carries, one house style throughout. */
function order(marks: string): string {
  if (!marks.includes(SHADDA)) return marks;
  return SHADDA + marks.replace(SHADDA, '');
}

const vowelOf = (g: Glyph | undefined): string => {
  if (!g) return '';
  for (const c of g.marks) {
    if (c === FATHA || c === FATHATAN) return FATHA;
    if (c === DAMMA || c === DAMMATAN) return DAMMA;
    if (c === KASRA || c === KASRATAN) return KASRA;
    if (c === SUKUN) return SUKUN;
  }
  return '';
};

/**
 * Whether the و or ي at `i` is a long vowel rather than a consonant: unmarked,
 * and after a letter whose vowel matches (or, in the house style, is left off).
 */
function isLongVowel(gs: Glyph[], i: number): boolean {
  const g = gs[i];
  if (!g || (g.ch !== 'و' && g.ch !== 'ي') || g.marks || i === 0) return false;
  const prev = gs[i - 1];
  if (prev.ch === ' ' || prev.ch === 'ا') return false;
  const v = vowelOf(prev);
  // After a bare consonant the vowel is simply left off (يَكْتُبونَ); after a
  // geminate (يُسَوّونَ) too. Only a second unmarked و/ي in a row is a consonant.
  const bare = v === '' && (prev.ch !== g.ch || prev.marks.includes(SHADDA));
  if (g.ch === 'و') return v === DAMMA || bare;
  return v === KASRA || bare;
}

const isLongLetter = (gs: Glyph[], i: number) =>
  gs[i] && (gs[i].ch === 'ا' || gs[i].ch === 'ى' || gs[i].ch === 'آ' || isLongVowel(gs, i));

/**
 * Fills in the marks the deck leaves off — the sukun on a consonant that has
 * no vowel (اِستَأجَرَ → اِسْتَأْجَرَ) and on a final consonant (كَتَبْتُمْ) — so
 * every form is fully voweled. The short vowel before a long-vowel letter is
 * still left off (قالَ، يَكْتُبونَ), as everywhere else in the app.
 */
export function completeVowels(word: string): string {
  return word
    .split(' ')
    .map((part) => {
      const gs = split(part);
      for (let i = 0; i < gs.length; i++) {
        const g = gs[i];
        if (g.ch === 'إ' && !g.marks) { g.marks = KASRA; continue; }
        if (!isLetter(g.ch) || g.marks.replace(SHADDA, '') !== '') continue;
        if (g.ch === 'ا' || g.ch === 'ى' || g.ch === 'آ' || g.ch === 'ة' || g.ch === 'ٱ') continue;
        // A consonantal و before a long vowel takes its vowel: يَنْوُونَ، تَنْوِينَ.
        if (g.ch === 'و' && i > 0 && vowelOf(gs[i - 1]) === SUKUN && gs[i + 1] && !gs[i + 1].marks
          && (gs[i + 1].ch === 'و' || gs[i + 1].ch === 'ي') && gs[i + 2] && !isMark(gs[i + 2].ch)) {
          g.marks += gs[i + 1].ch === 'و' ? DAMMA : KASRA;
          continue;
        }
        // Doubled ي (تَعْيِين، تَغْيِير): the first is a consonant with kasra, the second long.
        if (g.ch === 'ي' && gs[i + 1]?.ch === 'ي' && !gs[i + 1].marks) { g.marks += KASRA; continue; }
        if (isLongVowel(gs, i)) continue;
        // Word-initial hamzat al-waṣl alif is handled above; an initial
        // consonant always has a vowel in a real word, so it is left alone.
        if (i === 0) continue;
        // A hamza after a long alif at the end (دُعاء) carries no mark.
        if (g.ch === 'ء' && i === gs.length - 1) continue;
        if (g.marks.includes(SHADDA)) continue; // final يُحِبّ: case vowel added elsewhere
        const next = gs[i + 1];
        // A word-final consonant is left in pause (كاتِب), not given a sukun.
        if (!next) continue;
        if (isLongLetter(gs, i + 1)) continue;
        // The letter before tāʾ marbūṭa always carries fatha: كِتابَة.
        g.marks += next.ch === 'ة' ? FATHA : SUKUN;
      }
      return join(gs);
    })
    .join(' ');
}

/**
 * Puts every non-initial hamza on the seat its vowels call for: جِئْتُ (not
 * جِءْتُ), قَرَؤوا (not قَرَأوا), يَقْرَآنِ (not يَقْرَأانِ).
 */
export function fixHamza(word: string): string {
  return word.split(' ').map(fixHamzaWord).join(' ');
}

function fixHamzaWord(word: string): string {
  // أَ + أْ at the start of a word is written as one madda: آكُلُ، آخُذُ.
  let w = word.replace(/^أَ?أْ?/, (m) => (m.length > 1 && m !== 'أَ' ? 'آ' : m));
  const gs = split(w);
  for (let i = 1; i < gs.length; i++) {
    const g = gs[i];
    if (!HAMZAS.includes(g.ch)) continue;
    const prev = gs[i - 1];
    const next = gs[i + 1];
    let own = vowelOf(g);
    if (!own) {
      if (next?.ch === 'ا') own = FATHA;
      else if (next && isLongVowel(gs, i + 1)) own = next.ch === 'و' ? DAMMA : KASRA;
      else own = next ? SUKUN : '';
    }
    const yaSeat = prev.ch === 'ي' && (vowelOf(prev) === SUKUN || isLongVowel(gs, i - 1));
    const prevLong = prev.ch === 'ا' || isLongVowel(gs, i - 1) || yaSeat;
    let pv = vowelOf(prev);
    if (prev.ch === 'ا') pv = 'A';
    else if (isLongVowel(gs, i - 1)) pv = prev.ch === 'و' ? DAMMA : KASRA;

    let seat: string;
    if (!next) {
      // Final: on the line after a long vowel or a sukun, else by the vowel before.
      if (prevLong || pv === SUKUN || pv === '') seat = 'ء';
      else seat = pv === KASRA ? 'ئ' : pv === DAMMA ? 'ؤ' : 'أ';
    } else if (yaSeat || own === KASRA || pv === KASRA) {
      seat = 'ئ';
    } else if (own === DAMMA || pv === DAMMA) {
      seat = 'ؤ';
    } else if (pv === 'A') {
      seat = 'ء';
    } else {
      seat = 'أ';
    }
    g.ch = seat;
  }
  w = join(gs);
  // A hamza with fatha before a long alif becomes a madda: قَرَأَا → قَرَآ.
  return w.replace(/أَ?ا/g, 'آ');
}

/**
 * A stem ending in ن or ت swallows the same letter of the suffix into a
 * shadda: آمَنْنا → آمَنّا، سَكَتْتُ → سَكَتُّ.
 */
const assimilate = (word: string) => word.replace(/نْن/g, 'نّ').replace(/تْت/g, 'تّ').normalize('NFC');

/** Both passes, in the order that matters. */
export const finish = (word: string) => fixHamza(completeVowels(word.normalize('NFC'))).normalize('NFC');

/** The principal part with its final vowel: يَكتُب → يَكْتُبُ, كَتَب → كَتَبَ. */
function withFinalVowel(word: string, vowel: string): string {
  const gs = split(word);
  const last = gs[gs.length - 1];
  if (!last || !isLetter(last.ch) || 'اىوي'.includes(last.ch) && !last.marks) return word;
  if (last.ch === 'ء' && gs[gs.length - 2]?.ch === 'ا' && !last.marks) return word + vowel;
  if (VOWELS.some((v) => last.marks.includes(v)) || last.marks.includes(SUKUN)) return word;
  last.marks += vowel;
  return join(gs);
}

// -- Masdar --------------------------------------------------------------------

/** الكِتابة، التَّعَلُّم، الاِسْتِقْبال، التَّمَنّي. */
export function definiteMasdar(masdar: string | null | undefined): string | null {
  if (!masdar) return null;
  let m = masdar.normalize('NFC').trim();
  // Keep the head word: "تَعَرُّف على" → تَعَرُّف, "اِستِمتاع بـ" → اِستِمتاع.
  m = m.split(/\s|\//)[0].replace(/ـ$/, '');
  if (!m) return null;
  m = m.replace(/^الْ?/, '');
  m = finish(m);
  // A defective masdar's tanween becomes its ي once it is definite: تَوَلٍّ → التَّوَلّي.
  if (/[ٍ]ّ?$|ٍّ$/.test(m)) m = m.replace(/ّ?ٍّ?$/, SHADDA) + 'ي';
  m = m.replace(/[ًٌٍ]$/, '');
  const gs = split(m);
  const first = gs[0];
  if (first && SUN.has(first.ch) && !first.marks.includes(SHADDA)) first.marks = SHADDA + first.marks;
  return ('ال' + join(gs)).normalize('NFC');
}

// -- Participles ---------------------------------------------------------------

function radicals(root: string): string[] {
  return root.split('-').map((r) => r.trim()).filter(Boolean)
    .map((r) => (HAMZAS.includes(r) || r === 'آ' ? 'ء' : r === 'ى' ? 'ي' : r));
}

const weak = (c: string) => c === 'و' || c === 'ي';

/** Form I participles, from the root alone: their pattern has no lexical vowel. */
function formOneParticiples(root: string): { active: string; passive: string } | null {
  const r = radicals(root);
  if (r.length !== 3) return null;
  const [F, E, L] = r;
  let active: string;
  let passive: string;
  if (weak(L)) {
    active = F + 'ا' + E + KASRATAN; // رامٍ، داعٍ
    passive = 'مَ' + F + SUKUN + E + (L === 'و' ? DAMMA + 'وّ' : KASRA + 'يّ'); // مَدْعُوّ، مَرْمِيّ
  } else if (weak(E)) {
    active = F + 'ا' + (L === 'ء' ? 'ء' + KASRATAN : 'ئ' + KASRA + L); // قائِل، جاءٍ
    passive = 'مَ' + F + (E === 'و' ? 'و' : 'ي') + L; // مَقول، مَبيع
  } else if (E === L) {
    active = F + 'ا' + E + SHADDA; // ظانّ
    passive = 'مَ' + F + SUKUN + E + 'و' + L; // مَظْنون
  } else {
    active = F + 'ا' + E + KASRA + L; // كاتِب
    passive = 'مَ' + F + SUKUN + E + 'و' + L; // مَكْتوب
  }
  if (F === 'ء') active = 'آ' + active.slice(2); // آكِل
  return { active: finish(active), passive: finish(passive) };
}

/** Sets the vowel on glyph `i`, keeping a shadda. */
function setVowelAt(gs: Glyph[], i: number, vowel: string): void {
  const g = gs[i];
  g.marks = (g.marks.includes(SHADDA) ? SHADDA : '') + vowel;
}

/**
 * Participles of a derived form, from its present tense: the prefix becomes
 * مُ, and the vowel before the last radical is kasra for the active and fatha
 * for the passive (يُعَلِّمُ → مُعَلِّم / مُعَلَّم). The weak classes bend this
 * the way the language does: مُريد / مُراد, مُعْطٍ / مُعْطًى, مُحِبّ / مُحَبّ.
 */
function derivedParticiples(present: string, form: string): { active: string; passive: string } | null {
  const p = finish(present);
  const gs = split(p);
  if (gs[0]?.ch !== 'ي' && gs[0]?.ch !== 'ت') return null;
  const rest = gs.slice(1).map((g) => ({ ...g }));
  // Trim the final case vowel.
  const last = rest[rest.length - 1];
  if (!last) return null;
  last.marks = last.marks.includes(SHADDA) ? SHADDA : last.marks.replace(/[َُِ]/g, '');
  const head = 'مُ';
  const build = (g: Glyph[]) => finish(head + join(g));
  const copy = () => rest.map((g) => ({ ...g }));

  // Defective: يُعطي، يَشتَري، يَتَمَنّى.
  if ((last.ch === 'ي' || last.ch === 'ى') && !last.marks) {
    const a = copy(); a.pop(); setVowelAt(a, a.length - 1, KASRATAN);
    const b = copy(); b.pop(); setVowelAt(b, b.length - 1, FATHATAN);
    return { active: build(a), passive: build(b) + 'ى' };
  }
  // Doubled: يُحِبُّ، يَستَعِدُّ.
  if (last.marks.includes(SHADDA)) {
    const i = rest.length - 2;
    if (i < 0) return null;
    const a = copy(); const b = copy();
    if (form === 'VII' || form === 'VIII') return { active: build(a), passive: build(b) };
    setVowelAt(a, i, KASRA); setVowelAt(b, i, FATHA);
    return { active: build(a), passive: build(b) };
  }
  // Hollow: a long vowel before the last radical (يُريد، يَختار، يَستَطيع).
  const li = rest.length - 2;
  const lv = rest[li];
  if (lv && !lv.marks && (lv.ch === 'ا' || (lv.ch === 'ي' || lv.ch === 'و') && isLongVowel(rest, li))) {
    const a = copy();
    const b = copy();
    if (b[li].ch !== 'ا') {
      b[li].ch = 'ا';
      b[li - 1].marks = b[li - 1].marks.replace(/[ُِ]/g, '');
    }
    return { active: build(a), passive: build(b) };
  }
  // Sound.
  const a = copy(); const b = copy();
  setVowelAt(a, li, KASRA);
  setVowelAt(b, li, FATHA);
  return { active: build(a), passive: build(b) };
}

/** The two participles' Arabic, or null when the form cannot be worked out. */
export function participles(input: { root: string; form: string; present: string }): { active: string; passive: string } | null {
  if (input.form === 'I') return formOneParticiples(input.root);
  if (input.form === 'IX') return null;
  return derivedParticiples(input.present, input.form);
}

// -- The table -----------------------------------------------------------------

export interface VerbInput {
  root: string;
  form: string;
  past: string;
  present: string;
  masdar?: string | null;
  /**
   * The active present, for a verb given in the passive (وُلِدَ / يُولَدُ): the
   * participles come from the active verb whatever voice the table is in.
   */
  activePresent?: string | null;
  prefix?: string | null;
  english?: string | null;
  charts?: VerbEntry['charts'];
}

/** Strips what the deck writes around a principal part: "جاءَ بِـ", "ظَنَّ (ظَنَنْتُ)", "ما زالَ". */
export function cleanPart(text: string): string {
  return text
    .replace(/\(.*?\)/g, '')
    .replace(/\s+(بِـ|بـ|بِ|على|عَلى|عَن|عن|مِن|من|لِـ|لـ|في|إلى|إِلى)\s*$/, '')
    .replace(/^(ما|لَم|لم)\s+/, '')
    .trim();
}

/**
 * The whole table for one verb, without the participles' English (that is
 * written by hand and stored). Null when the verb fits no paradigm.
 */
export function buildVerbTable(input: VerbInput): VerbTable | null {
  const past = finish(withFinalVowel(cleanPart(input.past), FATHA));
  const present = input.present ? finish(withFinalVowel(cleanPart(input.present), DAMMA)) : '';
  const handPast = input.charts?.past;
  const handPresent = input.charts?.present;
  // A verb written out in full by hand (لَيْسَ) needs no paradigm at all.
  const handOnly = !!handPast && TABLE_ORDER.every((id) => handPast[id]) && input.charts?.present === null;
  const chart = handOnly ? null : conjugate({ root: input.root, past, present });
  if (!chart && !handOnly) return null;
  const pre = input.prefix ? input.prefix.trim() + ' ' : '';
  const merge = (worked: Chart | undefined, hand: Partial<Chart> | null | undefined): Chart => {
    const out = {} as Chart;
    for (const id of TABLE_ORDER) out[id] = hand?.[id] ?? worked?.[id] ?? '';
    return out;
  };
  const tidy = (c: Chart): Chart => {
    const out = {} as Chart;
    // ‑تُم ends in a sukun when it is written in full: كَتَبْتُمْ.
    for (const id of TABLE_ORDER) out[id] = pre + assimilate(finish(c[id])).replace(/(تُّ?|تُ)م$/, '$1مْ');
    return out;
  };
  const parts = handOnly ? null : participles({ root: input.root, form: input.form, present: input.activePresent ?? present });
  return {
    past: pre + past,
    present: present ? pre + present : '',
    english: input.english ?? null,
    masdar: definiteMasdar(input.masdar),
    prefix: input.prefix ?? null,
    pastChart: tidy(merge(chart?.past, handPast)),
    presentChart: handPresent === null || !chart ? null : tidy(merge(chart.present, handPresent)),
    active: { ar: parts?.active ?? '', en: null, exists: true },
    passive: { ar: parts?.passive ?? '', en: null, exists: true },
    highlight: null,
  };
}

/** A stored verb, as a table with its participles' English. */
export function entryTable(entry: VerbEntry): VerbTable | null {
  const t = buildVerbTable({
    root: entry.root,
    form: entry.form,
    past: entry.past,
    present: entry.present,
    masdar: entry.masdar,
    activePresent: entry.activePresent,
    prefix: entry.prefix,
    english: entry.english,
    charts: entry.charts,
  });
  if (!t) return null;
  t.active = { ...t.active, en: entry.activeEn, exists: entry.activeExists };
  t.passive = { ...t.passive, en: entry.passiveEn, exists: entry.passiveExists };
  return t;
}

const skeleton = (w: string) =>
  w.normalize('NFC').replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/^ال/, '').replace(/ة$/, '').trim();

/**
 * Which of a table's forms the card's own word is (كاتِب → the active
 * participle), so the panel can mark it. Compared without vowels, ال or a
 * feminine ة, on the first word of the card.
 */
export function whichForm(word: string, table: VerbTable): VerbTable['highlight'] {
  const w = skeleton((word.split(/[\s/،,(]/)[0] ?? ''));
  if (!w) return null;
  if (table.active.ar && skeleton(table.active.ar) === w) return 'active';
  if (table.passive.ar && skeleton(table.passive.ar) === w) return 'passive';
  if (table.masdar && skeleton(table.masdar) === w) return 'masdar';
  return null;
}
