/**
 * Loads the Wiktionary-derived dictionary (scripts/seo/data/dictionary.json.gz,
 * built by scripts/seo/wiktionary/build.py) and answers the questions the word
 * and root pages ask: which words share a root, which nouns belong to which
 * verb, and which words get a page.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';
import { vocalKey, formRank, asciiTranslit, rootSlugBase } from './text.mjs';

const CONTENT_POS = new Set(['noun', 'verb', 'adj', 'adv', 'num']);
// Senses a learner rarely needs. A word with only these is left to Wiktionary.
const DATED = new Set(['obsolete', 'archaic', 'dated', 'historical', 'rare']);

export const POS_LABEL = {
  noun: 'Noun', verb: 'Verb', adj: 'Adjective', adv: 'Adverb', num: 'Number',
  prep: 'Preposition', conj: 'Conjunction', pron: 'Pronoun', intj: 'Interjection',
  particle: 'Particle', det: 'Determiner',
};

export function loadDictionary(file) {
  const raw = JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'));
  const entries = raw.entries.map((e, id) => ({ ...e, id, et: String(e.et ?? 0), freq: e.freq || 0 }));
  const byRoot = new Map();
  for (const e of entries) {
    if (!e.root) continue;
    if (!byRoot.has(e.root)) byRoot.set(e.root, []);
    byRoot.get(e.root).push(e);
  }
  return { entries, byRoot };
}

/** Every sense of the word, flattened (heads and sub-senses). */
export function allGlosses(e) {
  const out = [];
  for (const s of e.senses || []) {
    out.push({ g: s.head, labels: s.labels || [] });
    for (const sub of s.subs || []) out.push({ g: sub.g, labels: sub.labels || [] });
  }
  return out;
}

// A sense that describes grammar rather than meaning: "instance noun of
// حَرُكَ", "elative degree of كَبِير", "plural of مَاء".
const GRAMMAR_NOTE = /^(instance noun|verbal noun|noun of place|noun of instrument|elative degree|plural|feminine|masculine|singulative|collective|diminutive|alternative \w+|nisba|active participle|passive participle)\b[^:;]* of\b/i;

/**
 * The first definition a learner should see: a current sense over a dated
 * one, a meaning over a grammar note. "instance noun of حَرُكَ: an instance of
 * movement" yields what follows the colon.
 */
export function mainGloss(e) {
  const senses = e.senses || [];
  const isDated = (x) => (x.labels || []).some((l) => DATED.has(l));
  const meaning = (x) => {
    if (!GRAMMAR_NOTE.test(x.head)) return x.head;
    const after = x.head.split(':').slice(1).join(':').trim();
    return after || '';
  };
  for (const pass of [(x) => !isDated(x), () => true]) {
    for (const x of senses) {
      if (!pass(x)) continue;
      const m = meaning(x);
      if (m) return m;
    }
  }
  return senses[0]?.head?.replace(/:$/, '') || '';
}

/**
 * The few words to show as a translation: "to write", "book".
 * Wiktionary's first sense can be a whole description ("to mark (symbols,
 * shapes …) on a surface, to write, to inscribe"); when its first phrase is
 * long, the most concise phrase of that sense is the better headline.
 */
export function headline(e, max = 42) {
  const g = mainGloss(e);
  if (!g) return '';
  // Split on commas/semicolons that are not inside parentheses.
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of g) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  const clean = (x) => {
    let out = x;
    // Innermost brackets first, so "(مِن (min) about)" goes completely.
    for (let prev = ''; prev !== out;) { prev = out; out = out.replace(/\([^()]*\)/g, ''); }
    return out.replace(/[()]/g, '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  };
  const first = parts[0].trim();
  let pick = clean(first);
  // A descriptive first phrase ("to mark (symbols …) on a surface") gives
  // way to the most concise phrase of the same sense ("to write").
  if ((first.includes('(') || pick.length > 25) && parts.length > 1) {
    pick = parts.map(clean).filter(Boolean).sort((a, b) => a.length - b.length)[0];
  }
  return pick.length > max ? `${pick.slice(0, max - 1).trimEnd()}…` : pick;
}

/** Is this entry worth a page of its own? */
export function isPageWorthy(e) {
  if (!e.root || !CONTENT_POS.has(e.pos)) return false;
  const senses = e.senses || [];
  if (!senses.length) return !!e.masdarOf?.length; // bare verbal noun, defined through its verb
  // Words whose every sense is obsolete or archaic are left to Wiktionary.
  return senses.some((s) => !(s.labels || []).some((l) => DATED.has(l)));
}

// ------------------------------------------------------------ root families

const familyCache = new Map();

/**
 * Group a root's words the way the language is organised: each verb with the
 * nouns that belong to it, then the rest.
 *
 * A noun is attached to a verb only on Wiktionary's own evidence: it is the
 * verb's listed verbal noun or participle, it is recorded as the verbal noun
 * of that verb, or its etymology names that exact verb. Nothing is attached
 * by guesswork, so a wrong pairing can only come from the source.
 */
export function family(dict, root) {
  if (familyCache.has(root)) return familyCache.get(root);
  const members = (dict.byRoot.get(root) || []).filter((e) => CONTENT_POS.has(e.pos));
  const verbs = members.filter((e) => e.pos === 'verb')
    .sort((a, b) => formRank(a.form) - formRank(b.form) || b.freq - a.freq);
  const nonVerbs = members.filter((e) => e.pos !== 'verb');
  const byKey = new Map();
  for (const e of nonVerbs) {
    const k = vocalKey(e.w);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(e);
  }
  const assigned = new Set();
  const groups = verbs.map((verb) => ({ verb, connected: [] }));

  const resolve = (word) => (byKey.get(vocalKey(word)) || [])
    .slice().sort((a, b) => b.freq - a.freq);

  for (const g of groups) {
    const v = g.verb;
    const add = (word, role) => {
      if (g.connected.some((c) => vocalKey(c.word) === vocalKey(word) && c.role === role)) return;
      const found = resolve(word).filter((e) => !assigned.has(e.id));
      if (found.length) {
        for (const e of found) {
          assigned.add(e.id);
          g.connected.push({ word: e.w, role, entry: e });
        }
      } else {
        g.connected.push({ word, role, entry: null });
      }
    };
    for (const m of v.masdar || []) add(m, 'verbal noun');
    for (const p of v.ap || []) add(p, 'active participle');
    for (const p of v.pp || []) add(p, 'passive participle');
  }

  // Second pass: nouns that point at a verb themselves.
  const verbKeys = groups.map((g) => vocalKey(g.verb.w));
  for (const e of nonVerbs) {
    if (assigned.has(e.id)) continue;
    let target = -1;
    let role = '';
    for (const m of e.masdarOf || []) {
      const i = verbKeys.indexOf(vocalKey(m));
      if (i !== -1) { target = i; role = 'verbal noun'; break; }
    }
    if (target === -1 && e.ety) {
      const ety = vocalKey(e.ety);
      let best = Infinity;
      verbKeys.forEach((k, i) => {
        const at = ety.indexOf(k);
        // Whole-word match: the verb must not be part of a longer word.
        if (at !== -1 && at < best && !/[ء-ي]/.test(ety[at + k.length] || '')
            && !/[ء-ي]/.test(ety[at - 1] || '')) {
          best = at;
          target = i;
        }
      });
      if (target !== -1) role = 'from this verb';
    }
    if (target !== -1) {
      assigned.add(e.id);
      groups[target].connected.push({ word: e.w, role, entry: e });
    }
  }

  for (const g of groups) {
    const order = { 'verbal noun': 0, 'active participle': 1, 'passive participle': 2, 'from this verb': 3 };
    g.connected.sort((a, b) => order[a.role] - order[b.role] || (b.entry?.freq || 0) - (a.entry?.freq || 0));
  }
  const others = nonVerbs.filter((e) => !assigned.has(e.id)).sort((a, b) => b.freq - a.freq);
  const result = { root, groups, others, size: members.length };
  familyCache.set(root, result);
  return result;
}

/** The verb group a word belongs to (itself if it is a verb), or null. */
export function groupOf(fam, e) {
  return fam.groups.find((g) => g.verb.id === e.id || g.connected.some((c) => c.entry?.id === e.id)) || null;
}

// ------------------------------------------------------------------- slugs

function entryKey(e) {
  return `${e.page}|${e.et}|${e.pos}|${e.w}`;
}

/** Persisted slug assignment, so a published URL never changes. */
export function makeSlugger(slugMap) {
  const taken = new Set(Object.values(slugMap));
  // Wiktionary occasionally has two entries with the same word, part of
  // speech and etymology; number the later ones so each keeps its own URL.
  const keyOwner = new Map();
  const keyOf = (e) => {
    const base = entryKey(e);
    let key = base;
    let n = 2;
    while (keyOwner.has(key) && keyOwner.get(key) !== e.id) key = `${base}#${n++}`;
    keyOwner.set(key, e.id);
    return key;
  };
  const ids = new Map();
  const keyFor = (e) => {
    if (!ids.has(e.id)) ids.set(e.id, keyOf(e));
    return ids.get(e.id);
  };
  // Slugs already handed to an entry in this run.
  const claimed = new Set();
  return {
    /** First pass: claim every URL whose entry is still present unchanged. */
    reserve(list) {
      for (const e of list) {
        const s = slugMap[keyFor(e)];
        if (s) claimed.add(s);
      }
    },
    word(e) {
      const key = keyFor(e);
      if (slugMap[key]) {
        claimed.add(slugMap[key]);
        return slugMap[key];
      }
      // Wiktionary sometimes renumbers etymologies. If the same word with the
      // same part of speech already had a URL that nothing else has claimed,
      // keep that URL rather than minting a new one.
      const [page, , pos, w] = key.split('|');
      const old = Object.keys(slugMap).find((k) => {
        const [p2, , pos2, w2] = k.split('|');
        return p2 === page && pos2 === pos && w2.replace(/#\d+$/, '') === w.replace(/#\d+$/, '')
          && !claimed.has(slugMap[k]);
      });
      if (old) {
        slugMap[key] = slugMap[old];
        delete slugMap[old];
        claimed.add(slugMap[key]);
        return slugMap[key];
      }
      const base = asciiTranslit(e.rom) || rootSlugBase(e.root || '') || 'word';
      let slug = base;
      let n = 2;
      while (taken.has(slug)) slug = `${base}-${n++}`;
      taken.add(slug);
      claimed.add(slug);
      slugMap[key] = slug;
      return slug;
    },
    peek(e) {
      return slugMap[keyFor(e)] || null;
    },
  };
}
