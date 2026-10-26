/**
 * Real example sentences from the app's own fully-vowelled corpus (the Smith &
 * Van Dyke Arabic Bible, tagged word by word with root and lemma).
 *
 * A sentence is used for a dictionary word only when the match is certain:
 * the word form in the verse must map to exactly one tagged lemma, and that
 * lemma must map to exactly one dictionary entry (same root, same consonants,
 * same kind of word, and the same vowels when consonants alone are ambiguous).
 */
import fs from 'node:fs';
import path from 'node:path';
import { normalizeArabic, vocalKey } from './text.mjs';

const PUNCT = /^[.,،؛:؟!"«»()\[\]]+|[.,،؛:؟!"«»()\[\]]+$/g;
const posClass = (p) => (p === 'verb' ? 'v' : 'n');

export function loadCorpus(publicDir) {
  const index = JSON.parse(fs.readFileSync(path.join(publicDir, 'bible/word-skeleton-index.json'), 'utf8'));
  const books = JSON.parse(fs.readFileSync(path.join(publicDir, 'bible/books.json'), 'utf8'));
  // skeleton -> lemma key, only where every tagged sense agrees on the lemma
  const skelToLemma = new Map();
  const lemmas = new Map(); // lemma key -> {lemma, root, pos}
  for (const [skel, senses] of Object.entries(index)) {
    const keys = new Set(senses.filter((s) => s.root).map((s) => `${s.lemma}|${s.root}`));
    for (const s of senses) {
      if (!s.root) continue;
      const k = `${s.lemma}|${s.root}`;
      if (!lemmas.has(k)) lemmas.set(k, { lemma: s.lemma, root: s.root, pos: s.pos });
    }
    if (keys.size === 1) skelToLemma.set(skel, [...keys][0]);
  }
  return { index, books, skelToLemma, lemmas, publicDir };
}

/** Map corpus lemma key -> dictionary entry id, only for unambiguous matches. */
export function linkCorpusToDictionary(corpus, dict) {
  const link = new Map();
  for (const [key, L] of corpus.lemmas) {
    const cands = (dict.byRoot.get(L.root) || []).filter((e) =>
      posClass(e.pos) === posClass(L.pos) && normalizeArabic(e.w) === normalizeArabic(L.lemma));
    let pick = cands.length === 1 ? cands : cands.filter((e) => vocalKey(e.w) === vocalKey(L.lemma));
    if (pick.length === 1) link.set(key, pick[0].id);
  }
  return link;
}

/**
 * Up to `perWord` short example verses for each linked dictionary entry.
 * Returns Map(entry id -> [{ar, en, ref, hit}]) where `hit` is the index of
 * the matching word in the verse (for highlighting).
 */
export function corpusExamples(corpus, link, wantedIds, perWord = 3) {
  const out = new Map();
  for (const book of corpus.books) {
    for (let ch = 1; ch <= book.chapters; ch++) {
      const file = path.join(corpus.publicDir, 'bible', book.code, `${ch}.json`);
      if (!fs.existsSync(file)) continue;
      let verses;
      try { verses = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { continue; }
      for (const v of verses) {
        if (!v.a || !v.e || v.a.length < 25 || v.a.length > 200) continue;
        const words = v.a.split(/\s+/);
        const seen = new Set();
        words.forEach((w, i) => {
          const lk = corpus.skelToLemma.get(normalizeArabic(w.replace(PUNCT, '')));
          if (!lk) return;
          const id = link.get(lk);
          if (id === undefined || !wantedIds.has(id) || seen.has(id)) return;
          seen.add(id);
          const list = out.get(id) || [];
          list.push({ ar: v.a, en: v.e, ref: `${book.name} ${ch}:${v.v}`, hit: i, len: v.a.length });
          list.sort((a, b) => a.len - b.len);
          if (list.length > perWord) list.length = perWord;
          out.set(id, list);
        });
      }
    }
  }
  return out;
}
