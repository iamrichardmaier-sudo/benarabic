/**
 * The Qur'an word bank joins the dictionary.
 *
 * the words-NNN.json files under scripts/quran/seed hold the rows loaded into public.words: every Qur'anic
 * content word and the other words of its roots, with root, verb form, plural and a verse. They
 * are read here as ordinary dictionary entries, so a root page lists the whole family and a word
 * page can be built for any of them.
 *
 * Wiktionary stays the authority where it already has the word: a row is skipped when the
 * dictionary holds the same spelling under the same root and part of speech, so nothing is
 * listed twice and no existing page changes its text.
 */
import fs from 'node:fs';
import path from 'node:path';
import { vocalKey } from './text.mjs';

const POS = { verb: 'verb', masdar: 'noun', noun: 'noun', adjective: 'adj', participle: 'adj', other: 'adv' };
const bare = (s) => String(s).replace(/[ً-ٰٟـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
const group = (pos) => (pos === 'verb' ? 'verb' : 'other');

export function addSupplement(dict, seedDir) {
  if (!fs.existsSync(seedDir)) return 0;
  const have = new Set(dict.entries.map((e) => `${bare(e.w)}|${e.root || ''}|${group(e.pos)}`));
  let added = 0;
  for (const batch of fs.readdirSync(seedDir).sort()) {
    const dir = path.join(seedDir, batch);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      for (const r of JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))) {
        if (!r.root || !POS[r.word_type]) continue;
        const pos = POS[r.word_type];
        const w = (r.word_voweled || r.word).replace(/\s*\([^)]*\)\s*$/, '').trim();
        const k = `${bare(w)}|${r.root}|${group(pos)}`;
        if (have.has(k)) continue;
        have.add(k);
        const ex = r.quran_example
          ? [{ ar: r.quran_example, en: r.quran_example_en || '', ref: `Qur'an, ${r.quran_reference || ''}` }]
          : [];
        const e = {
          id: dict.entries.length, w, page: bare(w), et: 'q', pos, rom: '',
          senses: [{ head: r.english, labels: [], ex }],
          root: r.root, freq: 0,
        };
        if (pos === 'verb') {
          e.form = r.verb_form || 'I';
          if (r.present_tense) e.present = [r.present_tense];
          if (r.masdar_form) e.masdar = [r.masdar_form];
        } else if (r.verb_form && r.word_type === 'masdar') {
          e.masdarOf = [];
        }
        if (r.gender) e.gender = r.gender;
        if (r.fusha_plural) e.pl = [r.fusha_plural];
        dict.entries.push(e);
        if (!dict.byRoot.has(e.root)) dict.byRoot.set(e.root, []);
        dict.byRoot.get(e.root).push(e);
        added++;
      }
    }
  }
  return added;
}
