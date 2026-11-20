import { supabase } from '@/integrations/supabase/client';
import type { FlashCard } from '@/lib/spaced-repetition';
import { buildVerbTable, cleanPart, entryTable, whichForm, type Participle, type VerbEntry, type VerbTable } from '@/lib/verb-table';
import { normalizeArabic } from '@/lib/arabic-normalize';
import bundledRows from '../../supabase/verb-entries.json';

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
 * Every verb written so far, shipped with the app. The database table holds
 * the same rows once it exists; until then (and offline) this is what gives
 * the participles their English.
 */
const BUNDLED: VerbEntry[] = (bundledRows as unknown as VerbEntryRow[]).map(fromRow);
const BUNDLED_BY_KEY = new Map(BUNDLED.map((e) => [e.key, e]));
/** A root with its hamza seat ignored: a card may write ج-ي-أ where the entry has ج-ي-ء. */
const rootKey = (root: string) => root.replace(/[أإآؤئ]/g, 'ء');
const BUNDLED_BY_ROOT = new Map<string, VerbEntry[]>();
for (const e of BUNDLED) BUNDLED_BY_ROOT.set(rootKey(e.root), [...(BUNDLED_BY_ROOT.get(rootKey(e.root)) ?? []), e]);

const pastSkeleton = (past: string) => normalizeArabic(cleanPart(past));

/**
 * The written entry for a verb, matched on root and form — and, where one
 * root and form carry two verbs (وَجَدَ found / وُجِدَ was found), on the past.
 */
export function bundledEntryFor(verb: { root: string; form: string; past?: string | null }): VerbEntry | null {
  const same = (BUNDLED_BY_ROOT.get(rootKey(verb.root)) ?? []).filter((e) => e.form === verb.form);
  if (same.length <= 1 || !verb.past) return same[0] ?? null;
  const want = pastSkeleton(verb.past);
  return same.find((e) => pastSkeleton(e.past) === want) ?? same[0];
}

/**
 * A verb's two participles with their English, for the drill: from its
 * written entry when there is one, otherwise worked out from the principal
 * parts (then without English). Null when the verb fits no paradigm.
 */
export function participlesFor(verb: { root: string; form: string; past: string; present: string }): { active: Participle; passive: Participle } | null {
  const entry = bundledEntryFor(verb);
  const t = (entry && entryTable(entry)) || buildVerbTable({ root: verb.root, form: verb.form, past: verb.past, present: verb.present });
  if (!t) return null;
  return { active: t.active, passive: t.passive };
}

/**
 * The written verbs a non-verb card is a form of (كاتِب → كَتَبَ), found by
 * its root and then by which participle or masdar the card's word is.
 */
const formOfCache = new Map<string, VerbEntry[]>();
function entriesCardIsFormOf(card: Pick<FlashCard, 'root' | 'word' | 'wordVoweled'>): VerbEntry[] {
  const word = card.wordVoweled || card.word || '';
  if (!card.root || !word) return [];
  const id = `${card.root}|${word}`;
  let found = formOfCache.get(id);
  if (!found) {
    const head = word.split(/[\s/،,(]/)[0] ?? '';
    found = (BUNDLED_BY_ROOT.get(rootKey(card.root)) ?? []).filter((e) => {
      const t = entryTable(e);
      const form = t ? whichForm(word, t) : null;
      // A masdar match must agree on a final ة: السُّفرة (dining table) is not السَّفَر.
      if (form === 'masdar') return endsInTaa(head) === endsInTaa(t?.masdar ?? '');
      return form !== null;
    });
    formOfCache.set(id, found);
  }
  return found;
}

const endsInTaa = (w: string) => /ة[ًٌٍَُِّْ]*$/.test(w.trim());

/** The written verbs behind a card, without asking the database. */
function bundledEntriesForCard(card: FlashCard): VerbEntry[] {
  const byKey = (card.verbKeys ?? []).map((k) => BUNDLED_BY_KEY.get(k)).filter((e): e is VerbEntry => !!e);
  if (byKey.length) return byKey;
  if (card.wordType === 'verb') {
    if (!card.root) return [];
    const e = bundledEntryFor({ root: card.root, form: card.verbForm ?? 'I', past: card.pastTense });
    return e ? [e] : [];
  }
  return entriesCardIsFormOf(card);
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
export function hasVerbTable(
  card: Pick<FlashCard, 'verbKeys' | 'wordType' | 'pastTense' | 'presentTense' | 'root' | 'word' | 'wordVoweled'>,
): boolean {
  if (card.verbKeys && card.verbKeys.length > 0) return true;
  if (card.wordType === 'verb') return !!card.pastTense && !!card.presentTense && !!card.root;
  return entriesCardIsFormOf(card).length > 0;
}

/**
 * The tables for a card: its stored verbs, or — for a verb card added since
 * the verbs were last filled in — a table worked out from the card's own
 * principal parts (then without the participles' English).
 */
export async function tablesForCard(card: FlashCard): Promise<VerbTable[]> {
  const keys = card.verbKeys ?? [];
  let entries: VerbEntry[] = [];
  if (keys.length) {
    // The shipped copy first; the database only for a verb written since.
    const missing = keys.filter((k) => !BUNDLED_BY_KEY.has(k));
    let fetched = new Map<string, VerbEntry>();
    if (missing.length) {
      try {
        fetched = await fetchVerbEntries(missing);
      } catch (err) {
        console.warn('verb_entries unavailable; using the shipped verbs only:', err);
      }
    }
    entries = keys.map((k) => BUNDLED_BY_KEY.get(k) ?? fetched.get(k)).filter((e): e is VerbEntry => !!e);
  }
  if (!entries.length) entries = bundledEntriesForCard(card);
  const tables = entries.map((e) => entryTable(e)).filter((t): t is VerbTable => !!t);
  if (tables.length) return mark(card, tables);
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
