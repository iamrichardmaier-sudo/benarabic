/**
 * The dictionary as data, for the app's own dictionary screens.
 *
 * The reference pages publish the 2,500 most-used words, which is the right
 * number for search engines. The app is not writing for search engines, so it
 * gets every entry in the dictionary — about 27,000 — from the same source
 * the pages are built from, so the two can never disagree.
 *
 *   /dict/index.json     one row per entry, enough to search and list it
 *   /dict/s/<n>.json     the entries themselves, sharded by root
 *
 * Sharding by root means opening a word fetches one small file that already
 * holds its whole root family, so the family view costs nothing extra. Words
 * without a root are spread by spelling. The family grouping (each verb with
 * its verbal nouns and participles) is computed here with the pages' own
 * family(), not re-derived in the browser.
 */
import { asciiTranslit, vocalKey } from './text.mjs';
import { family, headline } from './dictionary.mjs';

export const SHARDS = 256;

/** FNV-1a: stable across runs and machines, which a shard number must be. */
function hash(s) {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

export const shardOf = (e) => hash(e.root ? `r:${e.root}` : `p:${e.page}`) % SHARDS;

/**
 * A short meaning for a list. About 2,300 entries are verbal nouns Wiktionary
 * defines only through their verb; they read "verbal noun of كَتَبَ (to write)"
 * rather than showing nothing.
 */
function listGloss(dict, e) {
  const h = headline(e, 60);
  if (h || !e.masdarOf?.length) return h;
  const verb = e.masdarOf[0];
  const v = (dict.byRoot.get(e.root) || []).find((x) => x.pos === 'verb' && vocalKey(x.w) === vocalKey(verb));
  const vh = v ? headline(v, 30) : '';
  return `verbal noun of ${verb}${vh ? ` (${vh})` : ''}`;
}

/** Index row: [id, word, ascii, gloss, pos, form, shard, freq, slug, root]. */
export function appData(dict, { wordSlug }) {
  const sorted = dict.entries.slice().sort((a, b) => b.freq - a.freq || a.id - b.id);
  const index = sorted.map((e) => [
    e.id, e.w, asciiTranslit(e.rom || ''), listGloss(dict, e), e.pos, e.form || '',
    shardOf(e), e.freq, wordSlug(e) || '', e.root || '',
  ]);

  const shards = Array.from({ length: SHARDS }, () => ({ entries: {}, families: {} }));
  for (const e of dict.entries) {
    const { id, ...rest } = e;
    const slug = wordSlug(e);
    shards[shardOf(e)].entries[id] = slug ? { ...rest, slug } : rest;
  }
  for (const root of dict.byRoot.keys()) {
    const fam = family(dict, root);
    if (!fam.groups.length && !fam.others.length) continue;
    shards[shardOf({ root })].families[root] = {
      groups: fam.groups.map((g) => ({
        verb: g.verb.id,
        connected: g.connected.map((c) => [c.word, c.role, c.entry ? c.entry.id : null]),
      })),
      others: fam.others.map((e) => e.id),
    };
  }
  return { index, shards };
}
