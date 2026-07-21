// LLM-driven auto-tagger. Sends each Fusha word to the tag-word edge function,
// which returns root/form/grammar identity, voweled principal parts, and
// companion forms. Runs automatically after adding words and as a background
// backfill for any previously untagged cards.

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { CompanionForm, WordType } from './spaced-repetition';

export interface AutoTagSummary {
  tagged: number;
  failed: number;
}

interface DbRow {
  id: string;
  word: string;
  shaami: string | null;
}

interface TagResult {
  id: string;
  root: string | null;
  wordType: WordType;
  verbForm: string | null;
  wordVoweled: string;
  pastTense: string | null;
  presentTense: string | null;
  masdarForm: string | null;
  companionForms: CompanionForm[];
}

const BATCH_SIZE = 15;

/** Reports how many cards have finished (tagged or failed) out of the total. */
export type TagProgress = (done: number, total: number) => void;

async function tagBatch(rows: DbRow[]): Promise<AutoTagSummary> {
  const { data, error } = await supabase.functions.invoke('tag-word', {
    body: { words: rows.map((r) => ({ id: r.id, fusha: r.word, shaami: r.shaami })) },
  });
  if (error) throw error;

  const results = (data?.results ?? []) as TagResult[];
  const now = new Date().toISOString();

  let tagged = 0;
  let failed = rows.length - results.length;

  for (const r of results) {
    const { error: updateError } = await supabase
      .from('flashcards')
      .update({
        root: r.root,
        word_type: r.wordType,
        verb_form: r.verbForm,
        word_voweled: r.wordVoweled,
        past_tense: r.pastTense,
        present_tense: r.presentTense,
        masdar_form: r.masdarForm,
        companion_forms: r.companionForms as unknown as Json,
        tagged_at: now,
      })
      .eq('id', r.id);
    if (updateError) failed++;
    else tagged++;
  }

  return { tagged, failed };
}

async function tagRows(rows: DbRow[], onProgress?: TagProgress): Promise<AutoTagSummary> {
  let tagged = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const result = await tagBatch(rows.slice(i, i + BATCH_SIZE));
    tagged += result.tagged;
    failed += result.failed;
    onProgress?.(Math.min(i + BATCH_SIZE, rows.length), rows.length);
  }
  return { tagged, failed };
}

/**
 * Re-derive verb↔masdar pairings across the whole deck: cards sharing the
 * same (root, verbForm) where exactly one is a verb and one is a masdar
 * get linked via paired_word_id; ambiguous groups are flagged needs_review.
 */
async function repairVerbMasdarPairs(): Promise<void> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('id, root, word_type, verb_form, paired_word_id, needs_review');
  if (error) throw error;

  type Row = { id: string; root: string | null; word_type: string | null; verb_form: string | null; paired_word_id: string | null; needs_review: boolean };
  const rows = (data ?? []) as Row[];

  const buckets = new Map<string, Row[]>();
  for (const r of rows) {
    if (!r.root || !r.verb_form) continue;
    const key = `${r.root}|${r.verb_form}`;
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }

  const updates: { id: string; paired_word_id: string | null; needs_review: boolean }[] = [];
  for (const arr of buckets.values()) {
    const verbs = arr.filter((r) => r.word_type === 'verb');
    const masdars = arr.filter((r) => r.word_type === 'masdar');
    if (verbs.length === 1 && masdars.length === 1) {
      if (verbs[0].paired_word_id !== masdars[0].id) updates.push({ id: verbs[0].id, paired_word_id: masdars[0].id, needs_review: false });
      if (masdars[0].paired_word_id !== verbs[0].id) updates.push({ id: masdars[0].id, paired_word_id: verbs[0].id, needs_review: false });
    } else if (arr.length > 1) {
      for (const r of arr) {
        if (!r.needs_review) updates.push({ id: r.id, paired_word_id: r.paired_word_id, needs_review: true });
      }
    }
  }

  for (const u of updates) {
    await supabase
      .from('flashcards')
      .update({ paired_word_id: u.paired_word_id, needs_review: u.needs_review })
      .eq('id', u.id);
  }
}

/** Tag specific cards (e.g. right after adding new words). */
export async function tagCards(cards: { id: string; word: string; shaami?: string | null }[]): Promise<AutoTagSummary> {
  if (cards.length === 0) return { tagged: 0, failed: 0 };
  const rows: DbRow[] = cards.map((c) => ({ id: c.id, word: c.word, shaami: c.shaami ?? null }));
  const summary = await tagRows(rows);
  await repairVerbMasdarPairs();
  return summary;
}

/** Backfill: tag every card in the user's deck that hasn't been tagged yet. */
export async function tagUntaggedDeck(onProgress?: TagProgress): Promise<AutoTagSummary> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('id, word, shaami')
    .is('tagged_at', null);
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  if (rows.length === 0) return { tagged: 0, failed: 0 };

  const summary = await tagRows(rows, onProgress);
  await repairVerbMasdarPairs();
  return summary;
}

/** How many cards still need tagging (tagged_at is null). */
export async function countUntaggedCards(): Promise<number> {
  const { count, error } = await supabase
    .from('flashcards')
    .select('id', { count: 'exact', head: true })
    .is('tagged_at', null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Re-tag the entire deck from scratch, regardless of whether cards were
 * already tagged. Use for a full refresh (e.g. after switching the tagging
 * backend). Costs one AI call per BATCH_SIZE cards.
 */
export async function retagEntireDeck(onProgress?: TagProgress): Promise<AutoTagSummary> {
  const { data, error } = await supabase
    .from('flashcards')
    .select('id, word, shaami');
  if (error) throw error;

  const rows = (data ?? []) as DbRow[];
  if (rows.length === 0) return { tagged: 0, failed: 0 };

  const summary = await tagRows(rows, onProgress);
  await repairVerbMasdarPairs();
  return summary;
}
