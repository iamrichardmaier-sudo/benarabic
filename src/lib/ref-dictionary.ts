import { normalizeArabic } from './arabic-normalize';

/**
 * The reference dictionary: every Wiktionary-derived entry the public
 * dictionary pages are built from, about 27,000 words, served as static files
 * by scripts/seo (lib/app-data.mjs).
 *
 * Not to be confused with lib/dictionary.ts, which searches the tagged
 * corpus in the database. That one knows which words occur in the Bible; this
 * one knows what words mean, how they conjugate and which root family they
 * belong to, whether or not any text in the app uses them.
 *
 *   /dict/index.json   one row per entry, loaded once to search
 *   /dict/s/<n>.json   the entries, sharded by root (a shard holds whole families)
 */

export type IndexRow = [
  id: number, word: string, ascii: string, gloss: string, pos: string,
  form: string, shard: number, freq: number, slug: string, root: string,
];

export interface DictHit {
  id: number;
  /** Voweled headword. */
  word: string;
  /** Plain-letter transliteration, for typing "kitab". */
  ascii: string;
  /** Short meaning, for a list. */
  gloss: string;
  pos: string;
  form: string;
  shard: number;
  freq: number;
  /** The public page's slug, when the word has a page. */
  slug: string;
  root: string;
  /** Unvoweled, normalized spelling, for matching. */
  key: string;
}

export interface Sense {
  head: string;
  labels?: string[];
  ex?: { ar?: string; en?: string; ref?: string; tr?: string }[];
  subs?: { g: string; labels?: string[]; ex?: Sense['ex'] }[];
}

export interface DictEntry {
  id: number;
  w: string;
  page: string;
  pos: string;
  rom?: string;
  senses?: Sense[];
  ipa?: string;
  ety?: string;
  freq: number;
  root?: string;
  form?: string;
  gender?: 'm' | 'f';
  pl?: string[];
  sing?: string[];
  fem?: string[];
  mpl?: string[];
  fpl?: string[];
  coll?: string[];
  elative?: string[];
  present?: string[];
  masdar?: string[];
  masdarOf?: string[];
  ap?: string[];
  pp?: string[];
  conj?: Record<string, Record<string, string[]>>;
  audio?: string;
  slug?: string;
}

export interface Family {
  groups: { verb: number; connected: [word: string, role: string, id: number | null][] }[];
  others: number[];
}

interface Shard {
  entries: Record<string, Omit<DictEntry, 'id'>>;
  families: Record<string, Family>;
}

export const POS_LABEL: Record<string, string> = {
  noun: 'Noun', verb: 'Verb', adj: 'Adjective', adv: 'Adverb', num: 'Number',
  prep: 'Preposition', conj: 'Conjunction', pron: 'Pronoun', intj: 'Interjection',
  particle: 'Particle', det: 'Determiner',
};

const base = () => (import.meta.env?.BASE_URL ?? '/').replace(/\/?$/, '/');

let indexPromise: Promise<DictHit[]> | null = null;
const shardPromises = new Map<number, Promise<Shard>>();

export function toHit(r: IndexRow): DictHit {
  const [id, word, ascii, gloss, pos, form, shard, freq, slug, root] = r;
  return { id, word, ascii, gloss, pos, form, shard, freq, slug, root, key: normalizeArabic(word) };
}

/** The whole index, most common words first. Fetched once per visit. */
export function loadIndex(): Promise<DictHit[]> {
  if (!indexPromise) {
    indexPromise = fetch(`${base()}dict/index.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Dictionary index: ${r.status}`);
        return r.json() as Promise<IndexRow[]>;
      })
      .then((rows) => rows.map(toHit))
      .catch((err) => {
        indexPromise = null; // let the next attempt try again
        throw err;
      });
  }
  return indexPromise;
}

function loadShard(n: number): Promise<Shard> {
  let p = shardPromises.get(n);
  if (!p) {
    p = fetch(`${base()}dict/s/${n}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Dictionary shard ${n}: ${r.status}`);
        return r.json() as Promise<Shard>;
      })
      .catch((err) => {
        shardPromises.delete(n);
        throw err;
      });
    shardPromises.set(n, p);
  }
  return p;
}

/** An entry, with its whole root family and every family member it names. */
export async function loadEntry(hit: Pick<DictHit, 'id' | 'shard'>): Promise<{
  entry: DictEntry;
  family: Family | null;
  members: Map<number, DictEntry>;
}> {
  const shard = await loadShard(hit.shard);
  const raw = shard.entries[hit.id];
  if (!raw) throw new Error('That word is not in the dictionary.');
  const entry = { ...raw, id: hit.id } as DictEntry;
  const family = entry.root ? shard.families[entry.root] ?? null : null;
  const members = new Map<number, DictEntry>();
  for (const [id, e] of Object.entries(shard.entries)) {
    if (e.root && e.root === entry.root) members.set(Number(id), { ...e, id: Number(id) } as DictEntry);
  }
  return { entry, family, members };
}

/** A root's family, for the root view. */
export async function loadRoot(root: string, index: DictHit[]): Promise<{
  family: Family | null;
  members: Map<number, DictEntry>;
}> {
  // Roots arrive as the deck stores them (كتب, ك ت ب) as well as hyphenated.
  const want = rootKey(root);
  const any = index.find((h) => h.root && rootKey(h.root) === want);
  if (!any) return { family: null, members: new Map() };
  const { family, members } = await loadEntry(any);
  return { family, members };
}

/**
 * Finds an entry by what an address holds: its id, its public slug, or the
 * Arabic itself (from a card or a reader's popover). Arabic prefers the entry
 * spelled with the same vowels, then the most common one written the same.
 */
export function findHit(index: DictHit[], ref: string): DictHit | null {
  if (/^\d+$/.test(ref)) return index.find((h) => h.id === Number(ref)) ?? null;
  if (ARABIC.test(ref)) {
    const exact = index.find((h) => h.word === ref.trim());
    if (exact) return exact;
    const key = normalizeArabic(ref);
    return index.find((h) => h.key === key) ?? null; // the index is most common first
  }
  return index.find((h) => h.slug === ref) ?? null;
}

/** The address segment for an entry: its public slug when it has one, so links read well. */
export const refFor = (h: Pick<DictHit, 'id' | 'slug'>) => h.slug || String(h.id);

const ARABIC = /[؀-ۿ]/;
const rootKey = (s: string) => normalizeArabic(s).replace(/[-‐-―\s]/g, '');

/**
 * Search the whole dictionary, closest match first: in Arabic (with or without
 * vowels, or a root typed as ك-ت-ب or كتب), in transliteration ("kitab"), or
 * by meaning ("book"). Ties go to the more common word.
 */
export function searchIndex(index: DictHit[], query: string, limit = 30): DictHit[] {
  const q = query.trim();
  if (!q) return [];
  const scored: { h: DictHit; s: number }[] = [];

  if (ARABIC.test(q)) {
    const needle = normalizeArabic(q);
    const bare = rootKey(q);
    if (!needle) return [];
    for (const h of index) {
      let s = -1;
      if (h.key === needle) s = 0;
      else if (h.root && rootKey(h.root) === bare) s = 1;
      else if (h.key.startsWith(needle)) s = 2;
      else if (needle.length >= 2 && h.key.includes(needle)) s = 3;
      if (s >= 0) scored.push({ h, s });
    }
  } else {
    const needle = q.toLowerCase();
    const word = new RegExp(`(^|[^a-z])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`);
    for (const h of index) {
      const g = h.gloss.toLowerCase();
      const a = h.ascii.toLowerCase();
      // A meaning outranks a sound-alike: "silk" is حَرِير before it is سِلْك.
      let s = -1;
      if (g === needle || g === `to ${needle}`) s = 0;
      else if (a === needle) s = 1;
      else if (word.test(g)) s = g.startsWith(needle) || g.startsWith(`to ${needle}`) ? 1 : 2;
      else if (a.startsWith(needle)) s = 2.5;
      else if (needle.length >= 3 && (g.includes(needle) || a.includes(needle))) s = 3;
      if (s >= 0) scored.push({ h, s });
    }
  }

  // The index is already most-common first, so a stable sort on score keeps
  // that order within each score.
  return scored.sort((x, y) => x.s - y.s).slice(0, limit).map((x) => x.h);
}

/** The entry's senses flattened to a list of meanings with their labels and examples. */
export function meanings(e: DictEntry): { g: string; labels: string[]; ex: NonNullable<Sense['ex']>; sub: boolean }[] {
  const out: { g: string; labels: string[]; ex: NonNullable<Sense['ex']>; sub: boolean }[] = [];
  for (const s of e.senses ?? []) {
    out.push({ g: s.head, labels: s.labels ?? [], ex: s.ex ?? [], sub: false });
    for (const sub of s.subs ?? []) out.push({ g: sub.g, labels: sub.labels ?? [], ex: sub.ex ?? [], sub: true });
  }
  return out;
}

/** Recent dictionary searches, newest first, kept on this device. */
const RECENT_KEY = 'wazn-dict-recent';

export function recentSearches(): DictHit['id'][] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)).slice(0, 12) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(id: number): void {
  try {
    const next = [id, ...recentSearches().filter((x) => x !== id)].slice(0, 12);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* recents are a convenience */
  }
}
