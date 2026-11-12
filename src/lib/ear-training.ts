/**
 * Ear training: what the drills are made of.
 *
 * Three drills share this. Hear a word and pick its meaning; hear a word or a
 * sentence and type it; and hear one of two words that differ in a single
 * sound and say which it was. The last is the one Arabic learners need most
 * and are offered least: ح and ه, ص and س, ط and ت are different letters to an
 * Arabic speaker and the same sound to an English one until trained.
 */
import { normalizeArabic } from './arabic-normalize';
import type { FlashCard } from './spaced-repetition';

export interface MinimalPair {
  /** The contrast being trained, as shown: "ح / ه". */
  contrast: string;
  /** What to listen for. */
  hint: string;
  a: { ar: string; en: string };
  b: { ar: string; en: string };
}

const pair = (
  contrast: string, hint: string, a: [string, string], b: [string, string],
): MinimalPair => ({ contrast, hint, a: { ar: a[0], en: a[1] }, b: { ar: b[0], en: b[1] } });

const H = 'ح is breathed from deep in the throat, tight and hoarse; ه is the plain English h.';
const S = 'ص is s with the tongue pulled back, which darkens the vowel beside it; س is the plain s.';
const T = 'ط is t with the tongue pulled back and a darker vowel; ت is the plain t.';
const D = 'ض is d with the tongue pulled back and a darker vowel; د is the plain d.';
const Q = 'ق is made at the very back of the mouth; ك is the English k.';
const A = 'ع is voiced from the throat, squeezed; a hamza (أ) is a clean stop.';
const KH = 'خ is a scrape at the back of the mouth; ح is breath only, lower in the throat.';
const GH = 'خ is unvoiced, like clearing the throat; غ is the same place with the voice on.';
const TH = 'ث is th in "think"; س is s.';
const DH = 'ذ is th in "this"; ز is z.';
const LONG = 'A long vowel is held about twice as long as a short one.';
const DOUBLED = 'A doubled letter (shadda) is held: the consonant is leaned on before it is released.';

/**
 * Real words, fully voweled so the voice reads them as meant. Each pair
 * differs in the one sound named and nothing else.
 */
export const MINIMAL_PAIRS: MinimalPair[] = [
  pair('ح / ه', H, ['حَرَم', 'sanctuary'], ['هَرَم', 'pyramid']),
  pair('ح / ه', H, ['نَحْر', 'slaughter'], ['نَهْر', 'river']),
  pair('ح / ه', H, ['سَحْل', 'dragging'], ['سَهْل', 'easy; a plain']),
  pair('ح / ه', H, ['حَبَّ', 'he loved'], ['هَبَّ', 'it blew']),
  pair('ص / س', S, ['صَيْف', 'summer'], ['سَيْف', 'sword']),
  pair('ص / س', S, ['صَارَ', 'he became'], ['سَارَ', 'he walked']),
  pair('ص / س', S, ['نَصْر', 'victory'], ['نَسْر', 'eagle']),
  pair('ص / س', S, ['صُورَة', 'picture'], ['سُورَة', 'sura, chapter']),
  pair('ط / ت', T, ['طِين', 'clay'], ['تِين', 'figs']),
  pair('ط / ت', T, ['طَابَ', 'it was good'], ['تَابَ', 'he repented']),
  pair('ط / ت', T, ['بَطّ', 'ducks'], ['بَتّ', 'deciding, settling']),
  pair('ض / د', D, ['ضَرْب', 'hitting'], ['دَرْب', 'path']),
  pair('ض / د', D, ['ضَلَّ', 'he went astray'], ['دَلَّ', 'he pointed out']),
  pair('ض / د', D, ['فَرْض', 'duty'], ['فَرْد', 'individual']),
  pair('ق / ك', Q, ['قَلْب', 'heart'], ['كَلْب', 'dog']),
  pair('ق / ك', Q, ['قَالَ', 'he said'], ['كَالَ', 'he measured out']),
  pair('ق / ك', Q, ['شَوْق', 'longing'], ['شَوْك', 'thorns']),
  pair('ع / أ', A, ['عَمَل', 'work'], ['أَمَل', 'hope']),
  pair('ع / أ', A, ['عَلَم', 'flag'], ['أَلَم', 'pain']),
  pair('ع / أ', A, ['سَعَلَ', 'he coughed'], ['سَأَلَ', 'he asked']),
  pair('خ / ح', KH, ['خَال', 'maternal uncle'], ['حَال', 'state, condition']),
  pair('خ / ح', KH, ['نَخْل', 'palm trees'], ['نَحْل', 'bees']),
  pair('خ / ح', KH, ['خَلّ', 'vinegar'], ['حَلّ', 'solution']),
  pair('خ / غ', GH, ['خَيْر', 'good'], ['غَيْر', 'other than']),
  pair('خ / غ', GH, ['خَالِي', 'empty; my uncle'], ['غَالِي', 'expensive']),
  pair('ث / س', TH, ['ثَارَ', 'he revolted'], ['سَارَ', 'he walked']),
  pair('ذ / ز', DH, ['ذَلَّ', 'he was humbled'], ['زَلَّ', 'he slipped']),
  pair('ذ / ز', DH, ['ذَكِيّ', 'clever'], ['زَكِيّ', 'pure']),
  pair('long / short', LONG, ['جَمَل', 'camel'], ['جَمَال', 'beauty']),
  pair('long / short', LONG, ['مَطَر', 'rain'], ['مَطَار', 'airport']),
  pair('long / short', LONG, ['كَتَبَ', 'he wrote'], ['كَاتَبَ', 'he wrote to']),
  pair('doubled', DOUBLED, ['دَرَسَ', 'he studied'], ['دَرَّسَ', 'he taught']),
  pair('doubled', DOUBLED, ['عَلِمَ', 'he knew'], ['عَلَّمَ', 'he taught']),
  pair('doubled', DOUBLED, ['حَمَام', 'pigeons'], ['حَمَّام', 'bathroom']),
];

/** The contrasts, in the order they are listed above. */
export const CONTRASTS: string[] = [...new Set(MINIMAL_PAIRS.map((p) => p.contrast))];

/**
 * The text to say for a card, and every spelling a typed answer may match.
 *
 * A card's word field can hold two spellings ("طول / طِوال") or a plural note
 * ("نادي ج. نَوادي"); only the first is said, and either spelling of it is
 * accepted. Vowels, hamza seats and ة/ه are not graded: dictation is about
 * hearing the consonants and the long vowels, not typing tashkeel.
 */
export function dictationTarget(card: FlashCard, spoken?: string): { say: string; accept: string[] } {
  const first = (s: string | null | undefined) =>
    (s || '').split(/\s*(?:\/|ج\.)\s*/)[0].replace(/[!؟?.،]+$/g, '').trim();
  const say = first(spoken) || first(card.wordVoweled) || first(card.word);
  const accept = [say, first(card.word), first(card.wordVoweled)]
    .map((s) => normalizeArabic(s))
    .filter(Boolean);
  return { say, accept: [...new Set(accept)] };
}

/** Dropping the article is not a mishearing: كتاب for الكتاب counts. */
const bareArticle = (s: string) => s.split(' ').map((w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w)).join(' ');

export function checkDictation(input: string, accept: string[]): boolean {
  const typed = normalizeArabic(input.replace(/[!؟?.،,]/g, ''));
  if (!typed) return false;
  return accept.some((a) => a === typed || bareArticle(a) === bareArticle(typed));
}

/** Words of the answer the typed line is missing, and typed words that are not in it, for showing what was misheard. */
export function dictationDiff(input: string, target: string): { missing: string[]; extra: string[] } {
  const typed = normalizeArabic(input).split(' ').filter(Boolean);
  const want = target.split(/\s+/).filter(Boolean);
  const wantKeys = want.map((w) => normalizeArabic(w));
  return {
    missing: want.filter((_, i) => !typed.includes(wantKeys[i])),
    extra: typed.filter((t) => !wantKeys.includes(t)),
  };
}
