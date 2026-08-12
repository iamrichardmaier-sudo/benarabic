import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface BibleWordTag {
  surface: string;
  root: string | null;
  lemma: string | null;
  pos: string | null;
  verbForm: string | null;
  gloss: string | null;
}

// Tags never change once written, and the same high-frequency words (الله,
// قال, ...) recur constantly across chapters, so a session-lifetime cache
// keyed by surface form avoids re-querying words already seen.
const cache = new Map<string, BibleWordTag | null>();

/** Looks up tags for every word in the current chapter in one query. Words
 * that aren't tagged yet (or never will be -- particles, punctuation) are
 * simply absent from the returned map; callers render those as plain text. */
export function useBibleWordTags(surfaces: string[]) {
  const key = useMemo(() => [...new Set(surfaces)].sort().join('|'), [surfaces]);
  const [tags, setTags] = useState<Map<string, BibleWordTag>>(new Map());

  useEffect(() => {
    const unique = key ? key.split('|') : [];
    const uncached = unique.filter((s) => !cache.has(s));

    const applyFromCache = () => {
      const next = new Map<string, BibleWordTag>();
      for (const s of unique) {
        const tag = cache.get(s);
        if (tag) next.set(s, tag);
      }
      setTags(next);
    };

    if (uncached.length === 0) {
      applyFromCache();
      return;
    }

    let cancelled = false;
    supabase
      .from('bible_word_tags')
      .select('surface, root, lemma, pos, verb_form, gloss')
      .in('surface', uncached)
      .not('tagged_at', 'is', null)
      .then(({ data, error }) => {
        if (error) console.error('Could not load Bible word tags:', error);
        for (const s of uncached) cache.set(s, null);
        for (const row of data ?? []) {
          cache.set(row.surface, {
            surface: row.surface,
            root: row.root,
            lemma: row.lemma,
            pos: row.pos,
            verbForm: row.verb_form,
            gloss: row.gloss,
          });
        }
        if (!cancelled) applyFromCache();
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return tags;
}
