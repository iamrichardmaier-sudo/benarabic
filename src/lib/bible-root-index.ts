import { supabase } from '@/integrations/supabase/client';
import { normalizeArabic } from './arabic-normalize';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

const cache = new Map<string, BibleWordTag[]>();

/**
 * The definite article, when it really is one.
 *
 * The reader taps an inflected surface (الْكِتابُ) while the dictionary holds
 * the bare lemma (كِتاب), so comparing skeletons alone lists a word inside its
 * own family. Stripping needs the same care as the tagging pass: the article
 * is written with a bare alef carrying no vowel, whereas إِله and وَالِد carry
 * one, and folding those away would hide a real relative. Tested on the raw
 * text for that reason, before normalisation flattens the hamzas.
 */
const ARTICLE = /^[وفبك]?[\u064E\u064F\u0650]?ا(?![\u064B-\u0652])ل/;

/** A word's identity for "is this the same word?", article and all removed. */
function bareKey(word: string): string {
  return normalizeArabic(word.replace(ARTICLE, ''));
}

/**
 * The word family of a root: other words built on it, each with a meaning.
 *
 * Drawn from `dictionary` rather than from `bible_word_tags`. The tag table
 * holds one row per inflected spelling, and four fifths of the Book of Mormon
 * rows carry a root and nothing else — asking it for a root returns a column
 * of bare Arabic with no translations beside it, which teaches nothing. The
 * dictionary is one row per lemma and only exists where the corpus glosses the
 * word, so every entry it returns can say what it means.
 *
 * Ordered by how often the word occurs, because a family is a "see also" and
 * the words worth seeing first are the ones actually met while reading.
 */
export async function fetchWordsByRoot(root: string, excludeSurface: string): Promise<BibleWordTag[]> {
  const exclude = bareKey(excludeSurface);
  const cached = cache.get(root);
  if (cached) return cached.filter((w) => bareKey(w.surface) !== exclude);

  const { data, error } = await supabase
    .from('dictionary')
    .select('lemma, root, pos, verb_form, glosses')
    .eq('root', root)
    .order('occurrences', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Could not load root cross-references:', error);
    return [];
  }

  // Some roots carry two entries for one word that differ only in tashkeel
  // (رَبّ and رَبٌّ, both "Lord"). Listing both twice teaches nothing.
  const seen = new Set<string>();
  const words: BibleWordTag[] = [];
  for (const row of data ?? []) {
    const key = bareKey(row.lemma);
    if (seen.has(key)) continue;
    seen.add(key);
    words.push({
      surface: row.lemma,
      root: row.root,
      lemma: row.lemma,
      pos: row.pos,
      verbForm: row.verb_form,
      gloss: row.glosses?.[0] ?? null,
    });
  }

  cache.set(root, words);
  return words.filter((w) => bareKey(w.surface) !== exclude);
}

/**
 * Splits a root's family into the sense to lead with and the rest of the list.
 *
 * A word carrying its own gloss needs no stand-in, so the whole family stays a
 * list. A word with only a root borrows the commonest word on that root as an
 * approximation of what it is about — shown as the root's meaning, never as
 * the word's — and that entry is then dropped from the list below so it is not
 * printed twice.
 */
export function splitRootSense(
  ownGloss: string | null | undefined,
  related: BibleWordTag[] | null,
  surface = '',
): { rootSense: BibleWordTag | null; family: BibleWordTag[] } {
  const glossed = (related ?? []).filter((w) => w.gloss);
  if (ownGloss) return { rootSense: null, family: glossed };

  // Prefer the relative spelt like the word in front of the reader over the
  // merely commonest one. On س-م-و the commonest word is اِسْم "name", so
  // frequency alone would gloss السَماء "the heaven" as "name".
  const key = bareKey(surface);
  const i = key ? glossed.findIndex((w) => bareKey(w.surface) === key) : -1;
  const pick = i >= 0 ? i : 0;

  const rootSense = glossed[pick] ?? null;
  return { rootSense, family: glossed.filter((_, n) => n !== pick) };
}
