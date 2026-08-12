import { supabase } from '@/integrations/supabase/client';
import type { BibleWordTag } from '@/hooks/useBibleWordTags';

const cache = new Map<string, BibleWordTag[]>();

/** Every other tagged word sharing a root, deduplicated by lemma (many
 * inflected surface forms collapse to the same dictionary entry) and capped
 * at a handful -- this is a "see also" list, not an exhaustive concordance. */
export async function fetchWordsByRoot(root: string, excludeSurface: string): Promise<BibleWordTag[]> {
  const cached = cache.get(root);
  if (cached) return cached.filter((w) => w.surface !== excludeSurface);

  const { data, error } = await supabase
    .from('bible_word_tags')
    .select('surface, root, lemma, pos, verb_form, gloss')
    .eq('root', root)
    .not('tagged_at', 'is', null)
    .limit(60);

  if (error) {
    console.error('Could not load root cross-references:', error);
    return [];
  }

  const seenLemmas = new Set<string>();
  const words: BibleWordTag[] = [];
  for (const row of data ?? []) {
    const key = row.lemma ?? row.surface;
    if (seenLemmas.has(key)) continue;
    seenLemmas.add(key);
    words.push({
      surface: row.surface,
      root: row.root,
      lemma: row.lemma,
      pos: row.pos,
      verbForm: row.verb_form,
      gloss: row.gloss,
    });
    if (words.length >= 8) break;
  }

  cache.set(root, words);
  return words.filter((w) => w.surface !== excludeSurface);
}
