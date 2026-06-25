// Phase 2: Auto-tagger for Arabic verbs and masdars (Forms II–X).
// Pure functions. Operates on the Arabic surface form, tolerant of harakat.

import type { VerbForm, WordType } from './spaced-repetition';

export interface TagResult {
  root: string | null;          // 3-letter root joined by "-", e.g. "م-ر-ن"
  wordType: WordType;           // 'verb' | 'masdar' | 'other'
  verbForm: VerbForm | null;    // 'II'..'X' (Form I not auto-tagged)
  needsReview: boolean;         // true when the match is ambiguous
}

const SHADDA = '\u0651';
const ALIF = '\u0627';
const TA = '\u062A';
const MIM = '\u0645';
const NUN = '\u0646';
const SIN = '\u0633';
const YA = '\u064A';
const HA = '\u0647';

/**
 * Strip all harakat & tanween & sukun & dagger-alif, but KEEP shadda
 * (shadda is structurally meaningful for distinguishing forms).
 * Normalize hamza variants and final ta-marbuta to ha.
 */
export function normalizeForPattern(input: string): string {
  let s = input.trim();
  // Strip definite article ال only if followed by enough letters
  if (s.startsWith('\u0627\u0644') && s.length > 4) s = s.slice(2);

  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    // Remove fatha/kasra/damma/sukun/tanween/dagger alif, but keep shadda (U+0651).
    if (
      (cp >= 0x064b && cp <= 0x0650) ||
      cp === 0x0652 ||
      cp === 0x0670
    ) continue;
    // Normalize hamza carriers to bare alif
    if (cp === 0x0623 || cp === 0x0625 || cp === 0x0622) { out += ALIF; continue; }
    if (cp === 0x0624) { out += '\u0648'; continue; } // ؤ → و
    if (cp === 0x0626) { out += YA; continue; }       // ئ → ي
    if (cp === 0x0649) { out += YA; continue; }       // ى → ي
    if (cp === 0x0629) { out += HA; continue; }       // ة → ه
    out += ch;
  }
  return out;
}

/** Pattern tokens: literal char | 'R1' | 'R2' | 'R3' | 'S' (shadda) */
type Tok = string;

interface Pattern {
  form: VerbForm;
  type: WordType;          // verb | masdar
  toks: Tok[];
  ambiguous?: boolean;     // true when this pattern's skeleton is shared with another form
}

const PATTERNS: Pattern[] = [
  // ---- Verbs (perfect 3sg masculine, skeleton) ----
  // II:  fa''ala  → R1 R2 ّ R3              (4 chars)
  { form: 'II',   type: 'verb',   toks: ['R1','R2',SHADDA,'R3'], ambiguous: true },
  // III: fā'ala  → R1 ا R2 R3               (4)
  { form: 'III',  type: 'verb',   toks: ['R1',ALIF,'R2','R3'],   ambiguous: true },
  // IV:  af'ala  → ا R1 R2 R3               (4)
  { form: 'IV',   type: 'verb',   toks: [ALIF,'R1','R2','R3'],   ambiguous: true },
  // V:   tafa''ala → ت R1 R2 ّ R3            (5) – same skeleton as Form V masdar
  { form: 'V',    type: 'verb',   toks: [TA,'R1','R2',SHADDA,'R3'], ambiguous: true },
  // VI:  tafā'ala → ت R1 ا R2 R3             (5) – same skeleton as Form VI masdar
  { form: 'VI',   type: 'verb',   toks: [TA,'R1',ALIF,'R2','R3'], ambiguous: true },
  // VII: infa'ala → ا ن R1 R2 R3             (5)
  { form: 'VII',  type: 'verb',   toks: [ALIF,NUN,'R1','R2','R3'] },
  // VIII: ifta'ala → ا R1 ت R2 R3            (5)
  { form: 'VIII', type: 'verb',   toks: [ALIF,'R1',TA,'R2','R3'] },
  // IX:  if'alla  → ا R1 R2 R3 ّ             (5)
  { form: 'IX',   type: 'verb',   toks: [ALIF,'R1','R2','R3',SHADDA] },
  // X:   istaf'ala → ا س ت R1 R2 R3          (6)
  { form: 'X',    type: 'verb',   toks: [ALIF,SIN,TA,'R1','R2','R3'] },

  // ---- Masdars ----
  // II:  taf'īl   → ت R1 R2 ي R3             (5)
  { form: 'II',   type: 'masdar', toks: [TA,'R1','R2',YA,'R3'] },
  // III: mufā'ala → م R1 ا R2 R3 ه           (6)
  { form: 'III',  type: 'masdar', toks: [MIM,'R1',ALIF,'R2','R3',HA] },
  // IV:  if'āl    → ا R1 R2 ا R3             (5)
  { form: 'IV',   type: 'masdar', toks: [ALIF,'R1','R2',ALIF,'R3'] },
  // V:   tafa''ul → ت R1 R2 ّ R3             (5) – shares skeleton with verb V
  { form: 'V',    type: 'masdar', toks: [TA,'R1','R2',SHADDA,'R3'], ambiguous: true },
  // VI:  tafā'ul  → ت R1 ا R2 R3             (5) – shares skeleton with verb VI
  { form: 'VI',   type: 'masdar', toks: [TA,'R1',ALIF,'R2','R3'], ambiguous: true },
  // VII: infi'āl  → ا ن R1 R2 ا R3           (6)
  { form: 'VII',  type: 'masdar', toks: [ALIF,NUN,'R1','R2',ALIF,'R3'] },
  // VIII: ifti'āl → ا R1 ت R2 ا R3           (6)
  { form: 'VIII', type: 'masdar', toks: [ALIF,'R1',TA,'R2',ALIF,'R3'] },
  // IX:  if'ilāl  → ا R1 R2 R3 ا R3          (6, R3 repeats)
  { form: 'IX',   type: 'masdar', toks: [ALIF,'R1','R2','R3',ALIF,'R3'] },
  // X:   istif'āl → ا س ت R1 R2 ا R3         (7)
  { form: 'X',    type: 'masdar', toks: [ALIF,SIN,TA,'R1','R2',ALIF,'R3'] },
];

function matchPattern(norm: string, p: Pattern): { root: [string, string, string] } | null {
  const chars = Array.from(norm);
  if (chars.length !== p.toks.length) return null;
  const bindings: Record<string, string> = {};
  for (let i = 0; i < p.toks.length; i++) {
    const tok = p.toks[i];
    const ch = chars[i];
    if (tok === 'R1' || tok === 'R2' || tok === 'R3') {
      if (bindings[tok] && bindings[tok] !== ch) return null;
      // Root letters must be ordinary Arabic consonants — not shadda/alif special at this slot
      if (ch === SHADDA) return null;
      bindings[tok] = ch;
    } else {
      if (ch !== tok) return null;
    }
  }
  if (!bindings.R1 || !bindings.R2 || !bindings.R3) return null;
  return { root: [bindings.R1, bindings.R2, bindings.R3] };
}

/**
 * Tag a single Arabic word. Returns wordType='other' when no pattern matches.
 * needsReview=true when the match is ambiguous (e.g. Form V/VI verb vs masdar,
 * or short 4-letter Form II/III/IV verb skeletons that often collide with nouns).
 */
export function tagWord(word: string): TagResult {
  if (!word || !word.trim()) {
    return { root: null, wordType: 'other', verbForm: null, needsReview: false };
  }
  const norm = normalizeForPattern(word);

  // Try masdars first (more common in vocab decks), then verbs.
  const ordered = [
    ...PATTERNS.filter((p) => p.type === 'masdar'),
    ...PATTERNS.filter((p) => p.type === 'verb'),
  ];

  for (const p of ordered) {
    const m = matchPattern(norm, p);
    if (m) {
      return {
        root: m.root.join('-'),
        wordType: p.type,
        verbForm: p.form,
        needsReview: !!p.ambiguous,
      };
    }
  }

  return { root: null, wordType: 'other', verbForm: null, needsReview: false };
}
