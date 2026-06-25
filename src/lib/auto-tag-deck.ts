// Phase 2: Batch auto-tagger. Iterates the user's deck, fills root/wordType/
// verbForm/needsReview, and pairs verbs with their matching masdars
// (same root + same form). Idempotent: re-running re-computes everything.

import { supabase } from '@/integrations/supabase/client';
import { tagWord } from './verb-form-tagger';
import type { FlashCard } from './spaced-repetition';

export interface AutoTagSummary {
  total: number;
  verbs: number;
  masdars: number;
  other: number;
  pairs: number;
  needsReview: number;
}

interface DbRow {
  id: string;
  word: string;
}

export async function autoTagDeck(): Promise<AutoTagSummary> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('id, word');
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];

  // First pass: tag every word.
  type Tagged = {
    id: string;
    root: string | null;
    wordType: FlashCard['wordType'];
    verbForm: FlashCard['verbForm'];
    needsReview: boolean;
  };
  const tagged: Tagged[] = rows.map((r) => {
    const t = tagWord(r.word);
    return {
      id: r.id,
      root: t.root,
      wordType: t.wordType,
      verbForm: t.verbForm,
      needsReview: t.needsReview,
    };
  });

  // Second pass: pair verb ↔ masdar where (root, verbForm) is shared by
  // exactly one verb and one masdar. Ambiguous groups → mark needsReview.
  const buckets = new Map<string, Tagged[]>();
  for (const t of tagged) {
    if (!t.root || !t.verbForm) continue;
    const key = `${t.root}|${t.verbForm}`;
    const arr = buckets.get(key) ?? [];
    arr.push(t);
    buckets.set(key, arr);
  }

  const pairOf = new Map<string, string | null>(); // id -> paired id (or null)
  let pairs = 0;
  for (const arr of buckets.values()) {
    const verbs = arr.filter((x) => x.wordType === 'verb');
    const masdars = arr.filter((x) => x.wordType === 'masdar');
    if (verbs.length === 1 && masdars.length === 1) {
      pairOf.set(verbs[0].id, masdars[0].id);
      pairOf.set(masdars[0].id, verbs[0].id);
      pairs++;
    } else if (arr.length > 1) {
      // multiple verbs or multiple masdars sharing root+form — mark for review
      for (const x of arr) x.needsReview = true;
    }
  }

  // Write back. Use Promise.all in chunks to avoid hammering.
  const updates = tagged.map((t) =>
    supabase
      .from('flashcards')
      .update({
        root: t.root,
        word_type: t.wordType,
        verb_form: t.verbForm,
        paired_word_id: pairOf.get(t.id) ?? null,
        needs_review: t.needsReview,
      })
      .eq('id', t.id),
  );

  // Run in batches of 25 for responsiveness.
  const BATCH = 25;
  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    const results = await Promise.all(slice);
    for (const r of results) {
      if (r.error) throw r.error;
    }
  }

  return {
    total: tagged.length,
    verbs: tagged.filter((t) => t.wordType === 'verb').length,
    masdars: tagged.filter((t) => t.wordType === 'masdar').length,
    other: tagged.filter((t) => t.wordType === 'other').length,
    pairs,
    needsReview: tagged.filter((t) => t.needsReview).length,
  };
}
