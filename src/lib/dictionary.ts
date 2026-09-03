import { supabase } from '@/integrations/supabase/client';
import { normalizeArabic } from './arabic-normalize';
import type { VerbForm, WordType } from './spaced-repetition';

/**
 * Search over the shared dictionary — every distinct word the tagged Bible
 * corpus knows, collapsed from its inflected forms to one entry per lemma.
 *
 * It is built from the corpus rather than from anyone's flashcards. The
 * corpus is already shared, non-personal reference data, whereas `flashcards`
 * is RLS-scoped per user: pooling it would make one learner's private deck
 * searchable by everyone else. Contributing your own words is a deliberate
 * opt-in, not something to switch on by accident.
 */

export interface DictionaryEntry {
  id: string;
  lemma: string;
  root: string | null;
  pos: string | null;
  verbForm: string | null;
  glosses: string[];
  occurrences: number;
}

interface Row {
  id: string;
  lemma: string;
  root: string | null;
  pos: string | null;
  verb_form: string | null;
  glosses: string[] | null;
  occurrences: number;
}

const ARABIC = /[؀-ۿ]/;
const LIMIT = 30;

function toEntry(row: Row): DictionaryEntry {
  return {
    id: row.id,
    lemma: row.lemma,
    root: row.root,
    pos: row.pos,
    verbForm: row.verb_form,
    glosses: row.glosses ?? [],
    occurrences: row.occurrences,
  };
}

/** Escapes the wildcards PostgREST's ilike filter would otherwise interpret. */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, (ch) => `\\${ch}`);
}

/**
 * Words matching `query`, commonest first.
 *
 * Arabic is matched on the consonant skeleton against `lemma_key`, which the
 * database fills with the same normalisation `normalizeArabic` applies here —
 * so a learner typing what they can hear finds a word the corpus stores fully
 * vowelled. English is matched against the flattened gloss list.
 */
export async function searchDictionary(query: string): Promise<DictionaryEntry[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const column = ARABIC.test(q) ? 'lemma_key' : 'gloss_text';
  const needle = ARABIC.test(q) ? normalizeArabic(q) : q;

  const { data, error } = await supabase
    .from('dictionary')
    .select('id, lemma, root, pos, verb_form, glosses, occurrences')
    .ilike(column, `%${escapeLike(needle)}%`)
    .order('occurrences', { ascending: false })
    .limit(LIMIT);

  if (error) {
    console.error('Dictionary search failed:', error);
    throw error;
  }
  return ((data ?? []) as unknown as Row[]).map(toEntry);
}

/** Other words on the same root, for the "word family" of a dictionary entry. */
export async function entriesByRoot(root: string, excludeId: string): Promise<DictionaryEntry[]> {
  const { data, error } = await supabase
    .from('dictionary')
    .select('id, lemma, root, pos, verb_form, glosses, occurrences')
    .eq('root', root)
    .order('occurrences', { ascending: false })
    .limit(8);

  if (error) {
    console.error('Root lookup failed:', error);
    return [];
  }
  return ((data ?? []) as unknown as Row[]).map(toEntry).filter((e) => e.id !== excludeId);
}

const POS_TO_WORD_TYPE: Record<string, WordType> = {
  verb: 'verb',
  noun: 'noun',
  adjective: 'adjective',
  participle: 'participle',
  masdar: 'masdar',
};

/** The card fields a dictionary entry can fill in on its own. */
export function entryToCardFields(entry: DictionaryEntry): {
  word: string;
  english: string;
  root: string | null;
  wordType: WordType;
  verbForm: VerbForm | null;
} {
  return {
    word: entry.lemma,
    // The corpus glosses words in context, so the commonest reading is the
    // headword and the rest are dropped rather than crammed onto the card.
    english: entry.glosses[0] ?? '',
    root: entry.root,
    wordType: (entry.pos && POS_TO_WORD_TYPE[entry.pos]) || 'other',
    verbForm: (entry.verbForm as VerbForm | null) ?? null,
  };
}
