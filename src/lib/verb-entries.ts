import { supabase } from '@/integrations/supabase/client';
import type { FlashCard } from '@/lib/spaced-repetition';
import { buildVerbTable, entryTable, whichForm, type VerbEntry, type VerbTable } from '@/lib/verb-table';

/** A verb_entries row as the database returns it. */
interface VerbEntryRow {
  key: string;
  root: string;
  form: string;
  past: string;
  present: string;
  masdar: string | null;
  english: string | null;
  prefix: string | null;
  active_present: string | null;
  active_en: string | null;
  active_exists: boolean;
  passive_en: string | null;
  passive_exists: boolean;
  charts: VerbEntry['charts'];
}

export function fromRow(row: VerbEntryRow): VerbEntry {
  return {
    key: row.key,
    root: row.root,
    form: row.form,
    past: row.past,
    present: row.present ?? '',
    masdar: row.masdar,
    english: row.english,
    prefix: row.prefix,
    activePresent: row.active_present,
    activeEn: row.active_en,
    activeExists: row.active_exists,
    passiveEn: row.passive_en,
    passiveExists: row.passive_exists,
    charts: row.charts,
  };
}

/**
 * Entries already fetched this session. The rows are small and change only
 * when a verb is corrected, so one fetch per verb per visit is plenty.
 */
const cache = new Map<string, VerbEntry | null>();

export async function fetchVerbEntries(keys: string[]): Promise<Map<string, VerbEntry>> {
  const missing = keys.filter((k) => !cache.has(k));
  if (missing.length) {
    const { data, error } = await supabase
      .from('verb_entries' as never)
      .select('*')
      .in('key', missing);
    if (error) throw error;
    for (const k of missing) cache.set(k, null);
    for (const row of (data ?? []) as unknown as VerbEntryRow[]) cache.set(row.key, fromRow(row));
  }
  const out = new Map<string, VerbEntry>();
  for (const k of keys) {
    const e = cache.get(k);
    if (e) out.set(k, e);
  }
  return out;
}

/** Whether a card gets a Conjugate button at all. */
export function hasVerbTable(card: Pick<FlashCard, 'verbKeys' | 'wordType' | 'pastTense' | 'presentTense' | 'root'>): boolean {
  if (card.verbKeys && card.verbKeys.length > 0) return true;
  return card.wordType === 'verb' && !!card.pastTense && !!card.presentTense && !!card.root;
}

/**
 * The tables for a card: its stored verbs, or — for a verb card added since
 * the verbs were last filled in — a table worked out from the card's own
 * principal parts (then without the participles' English).
 */
export async function tablesForCard(card: FlashCard): Promise<VerbTable[]> {
  const keys = card.verbKeys ?? [];
  if (keys.length) {
    const entries = await fetchVerbEntries(keys);
    const tables = keys
      .map((k) => entries.get(k))
      .filter((e): e is VerbEntry => !!e)
      .map((e) => entryTable(e))
      .filter((t): t is VerbTable => !!t);
    if (tables.length) return mark(card, tables);
  }
  if (card.wordType === 'verb' && card.root && card.pastTense && card.presentTense) {
    const t = buildVerbTable({
      root: card.root,
      form: card.verbForm ?? 'I',
      past: card.pastTense,
      present: card.presentTense,
      masdar: card.masdarForm,
    });
    if (t) return mark(card, [t]);
  }
  return [];
}

function mark(card: FlashCard, tables: VerbTable[]): VerbTable[] {
  const word = card.wordVoweled || card.word;
  return tables.map((t) => ({ ...t, highlight: card.wordType === 'verb' ? null : whichForm(word, t) }));
}
