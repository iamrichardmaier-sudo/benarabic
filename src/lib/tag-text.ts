import { supabase } from '@/integrations/supabase/client';
import { tokenize } from '@/lib/transcript-mask';
import { skeletonOf, type WordSense } from '@/hooks/useWordSkeletonIndex';

/** Punctuation clinging to a word, which is not part of it. */
const EDGE_PUNCTUATION = /^[.,،؛:؟!"'«»()[\]{}\-–—…]+|[.,،؛:؟!"'«»()[\]{}\-–—…]+$/g;

/** How many words go to the model at once. */
const BATCH = 12;

/**
 * A ceiling on one save.
 *
 * Tagging is a model call per batch, so a pasted novel would take an hour and
 * cost accordingly. A song or an article is comfortably inside this; anything
 * larger is tagged as far as the limit and the rest is left to the shared
 * index.
 */
export const MAX_WORDS = 240;

export interface TagProgress {
  done: number;
  total: number;
}

function bare(word: string): string {
  return word.replace(EDGE_PUNCTUATION, '').trim();
}

/**
 * The distinct words of a text that nothing already explains, newest-first by
 * nothing in particular — order is just the order they are met.
 *
 * Keyed by consonant skeleton because that is what the reader looks up by: two
 * spellings of one word are one entry, and a word the shared scripture index
 * already covers is left to it.
 */
export function wordsNeedingTags(
  text: string,
  isCovered: (skeleton: string) => boolean,
): { skeleton: string; word: string }[] {
  const seen = new Set<string>();
  const out: { skeleton: string; word: string }[] = [];
  for (const token of tokenize(text)) {
    if (!token.isWord) continue;
    const word = bare(token.text);
    if (!word) continue;
    const skeleton = skeletonOf(word);
    if (!skeleton || seen.has(skeleton)) continue;
    seen.add(skeleton);
    if (isCovered(skeleton)) continue;
    out.push({ skeleton, word });
  }
  return out;
}

interface TagRow {
  id: string;
  gloss: string | null;
  root: string | null;
  wordType: string | null;
  verbForm: string | null;
  wordVoweled: string | null;
}

/**
 * Tag a text's own words, so its own reader can hover them.
 *
 * Batched rather than sent whole: the model has an output ceiling, and a
 * failed batch should cost one batch rather than the lot. A batch that fails
 * is skipped — a partly-tagged text is useful, and refusing to save because
 * one call timed out would not be.
 */
export async function tagWords(
  words: { skeleton: string; word: string }[],
  onProgress?: (p: TagProgress) => void,
): Promise<Record<string, WordSense[]>> {
  const wanted = words.slice(0, MAX_WORDS);
  const tags: Record<string, WordSense[]> = {};
  onProgress?.({ done: 0, total: wanted.length });

  for (let i = 0; i < wanted.length; i += BATCH) {
    const batch = wanted.slice(i, i + BATCH);
    try {
      const { data, error } = await supabase.functions.invoke('tag-word', {
        body: { words: batch.map((w) => ({ id: w.skeleton, fusha: w.word })) },
      });
      if (error) throw error;
      for (const row of (data?.results ?? []) as TagRow[]) {
        const source = batch.find((w) => w.skeleton === row.id);
        if (!source) continue;
        // A word with no meaning found is not worth storing: the popover would
        // open on a heading and nothing else.
        if (!row.gloss && !row.root) continue;
        tags[row.id] = [
          {
            lemma: row.wordVoweled || source.word,
            gloss: row.gloss ?? '',
            root: row.root,
            pos: row.wordType ?? 'other',
            verbForm: row.verbForm,
          },
        ];
      }
    } catch (err) {
      console.error('Could not tag a batch of words:', err);
    }
    onProgress?.({ done: Math.min(i + BATCH, wanted.length), total: wanted.length });
  }

  return tags;
}
