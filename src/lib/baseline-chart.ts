import { conjugate, type Conjugation } from './conjugation';
import { baselineFor } from './verb-baselines';

/**
 * The full regular chart for a verb form, and a way to tell where a real verb
 * departs from it.
 *
 * The baseline chart is the same generator that charts the deck's verbs, run
 * on ف-ع-ل with the form's baseline principal parts. Because it is the same
 * code, a cell that comes out different for a real verb is a real departure
 * from the pattern, not an accident of two different spellings.
 */

const BASELINE_ROOT = 'ف-ع-ل';

/**
 * Form IX is a geminate pattern (اِفْعَلَّ). Built on a sound root the
 * generator would write forms that do not exist (اِفْعَلّْتُ for "I", where it
 * is اِفْعَلَلْتُ), so it has no baseline chart rather than a wrong one.
 */
const NO_CHART = new Set(['IX']);

const cache = new Map<string, Conjugation | null>();

/** The regular past and present chart for a form, or null where there is none to give. */
export function baselineChart(form: string | null | undefined): Conjugation | null {
  if (!form || NO_CHART.has(form)) return null;
  if (cache.has(form)) return cache.get(form) ?? null;
  const b = baselineFor(form);
  const chart = b ? conjugate({ root: BASELINE_ROOT, past: b.past.text, present: b.present.text }) : null;
  cache.set(form, chart);
  return chart;
}

// -- Whether a word follows the pattern ---------------------------------------

const SUKUN = 'ْ';
const SHADDA = 'ّ';
const SHORT_VOWELS = /[ً-ِْ]/g; // tanwin, fatha, damma, kasra, sukun (not shadda)
const MARK = /[ً-ْٰ]/;

/** Letters that stand in for one another when matching a root to a word. */
const FOLD: Record<string, string> = {
  أ: 'ء', إ: 'ء', آ: 'ء', ؤ: 'ء', ئ: 'ء', ى: 'ي', ة: 'ه',
};
const fold = (c: string) => FOLD[c] ?? c;

interface Cluster {
  base: string;
  marks: string;
}

/** A letter with the marks on it, marks in a fixed order so spelling order does not matter. */
function clusters(word: string): Cluster[] {
  const out: Cluster[] = [];
  for (const ch of word.normalize('NFC').replace(/ـ/g, '')) {
    if (MARK.test(ch) && out.length > 0) out[out.length - 1].marks += ch;
    else if (!MARK.test(ch) && ch.trim()) out.push({ base: ch, marks: '' });
  }
  for (const c of out) c.marks = [...c.marks].sort().join('');
  return out;
}

/**
 * What is compared: the sukun is dropped (it is often left off the verbs on
 * file) and so is the vowel on the last letter (the case ending, often left
 * off too). The vowels inside the word stay, since a different stem vowel is
 * exactly what a departure from Form I looks like. `ignoreVowels` drops them
 * all, shadda excepted, for the masdar, whose vowelling on file varies most.
 */
function comparable(cs: Cluster[], ignoreVowels: boolean): Cluster[] {
  return cs.map((c, i) => {
    let marks = c.marks.replace(SUKUN, '');
    if (ignoreVowels || i === cs.length - 1) marks = marks.replace(SHORT_VOWELS, '');
    return { base: c.base, marks };
  });
}

const same = (a: Cluster[], b: Cluster[]) =>
  a.length === b.length && a.every((c, i) => c.base === b[i].base && c.marks === b[i].marks);

export interface FollowOptions {
  /** Compare letters and shadda only. */
  ignoreVowels?: boolean;
}

/**
 * Whether `word`, a form of the verb with this root, is exactly the baseline
 * pattern with the root's letters in place of ف ع ل.
 *
 * Every way of reading three of the word's letters as the root is tried, since
 * an affix can share a letter with the root (the س of اِسْتَسْفَرَ, on س-ف-ر).
 * A weak root whose letter has changed or gone, as in قُلْتُ on ق-و-ل, finds no
 * reading and so is reported as departing, which is the point of showing it.
 */
export function followsBaseline(word: string, root: string, baseline: string, options: FollowOptions = {}): boolean {
  const radicals = root.split('-').map((r) => r.trim()).filter(Boolean);
  if (radicals.length !== 3) return false;
  const ignoreVowels = !!options.ignoreVowels;
  const target = comparable(clusters(baseline), ignoreVowels);
  const cs = clusters(word);
  if (cs.length !== target.length) return false;

  const spots = radicals.map((r) => cs.flatMap((c, i) => (fold(c.base) === fold(r) ? [i] : [])));
  const slots = ['ف', 'ع', 'ل'];
  for (const i1 of spots[0]) {
    for (const i2 of spots[1]) {
      if (i2 <= i1) continue;
      for (const i3 of spots[2]) {
        if (i3 <= i2) continue;
        const read = cs.map((c, i) => {
          const at = i === i1 ? 0 : i === i2 ? 1 : i === i3 ? 2 : -1;
          return at === -1 ? c : { base: slots[at], marks: c.marks };
        });
        if (same(comparable(read, ignoreVowels), target)) return true;
      }
    }
  }
  return false;
}
