#!/usr/bin/env node
/**
 * Wazn — static reference pages (dictionary, roots, verb forms, guides).
 *
 * Runs before `vite build` (see package.json) and writes plain HTML into
 * public/, which Vite copies into dist/. Plain HTML rather than React SSR:
 * the app is client-rendered and behind auth, while these pages must be fully
 * readable by crawlers and fast for first-time visitors. Generated output is
 * not committed (.gitignore); only the inputs are.
 *
 * Inputs (all local, no database or network needed):
 *   scripts/seo/data/dictionary.json.gz   Wiktionary-derived dictionary (see wiktionary/build.py)
 *   scripts/seo/config.json               how many word pages to publish
 *   scripts/seo/word-slugs.json, root-slugs.json   persisted URLs (never change once assigned)
 *   scripts/seo/root-meanings.json        curated root meanings
 *   public/bible/**                       tagged corpus, for example sentences
 *
 * Every page is checked (validate()) before anything is written; a broken
 * internal link, duplicate title or malformed page fails the build.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SITE } from './lib/layout.mjs';
import { asciiTranslit, rootSlugBase, shortGloss } from './lib/text.mjs';
import { loadDictionary, isPageWorthy, family, makeSlugger, mainGloss, headline } from './lib/dictionary.mjs';
import { loadCorpus, linkCorpusToDictionary, corpusExamples } from './lib/corpus.mjs';
import { renderWord } from './lib/word-page.mjs';
import {
  renderRoot, renderForm, renderRootsHub, renderFormsHub, renderGuide,
  renderWordsHub, renderLetter, renderMostCommon, render404, searchIndex, LETTERS, firstLetter,
} from './lib/site-pages.mjs';
import { FORM_LIST } from './lib/forms.mjs';
import { validate } from './lib/validate.mjs';
import { appData } from './lib/app-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const PUBLIC = path.join(REPO, 'public');
const readJson = (f, fallback) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);

const config = readJson(path.join(__dirname, 'config.json'), {});
const WORD_PAGES = Number(process.env.SEO_WORD_PAGES || config.wordPages || 2500);
const MIN_ROOT_FAMILY = config.minRootFamily || 3;

// ------------------------------------------------------------------- data

console.log('Loading dictionary…');
const dict = loadDictionary(path.join(__dirname, 'data/dictionary.json.gz'));
const rootMeanings = readJson(path.join(__dirname, 'root-meanings.json'), {});

// Word pages: the most-used page-worthy words first. Raising wordPages in
// config.json publishes the next batch; earlier URLs never change.
// Wiktionary has a few exact duplicates (same word, part of speech and
// first meaning); publish only the first of each.
const seenWord = new Set();
const candidates = dict.entries.filter(isPageWorthy)
  .filter((e) => e.freq > 0)
  .sort((a, b) => b.freq - a.freq || a.id - b.id)
  .filter((e) => {
    const k = `${e.w}|${e.pos}|${mainGloss(e)}`;
    if (seenWord.has(k)) return false;
    seenWord.add(k);
    return true;
  });
const words = candidates.slice(0, WORD_PAGES);
const published = new Set(words.map((e) => e.id));

const WORD_SLUGS = path.join(__dirname, 'word-slugs.json');
const slugMap = readJson(WORD_SLUGS, {});
const slugger = makeSlugger(slugMap);
slugger.reserve(words);
for (const e of words) slugger.word(e); // assign in frequency order: common words get the clean slug
const wordSlug = (e) => (published.has(e.id) ? slugger.peek(e) : null);

// Root pages: every root with a real family and at least one published word.
const ROOT_SLUGS = path.join(__dirname, 'root-slugs.json');
const rootSlugMap = readJson(ROOT_SLUGS, {});
const takenRootSlugs = new Set(Object.values(rootSlugMap));
const roots = [...new Set(words.map((e) => e.root))]
  .filter((r) => family(dict, r).size >= MIN_ROOT_FAMILY)
  .sort((a, b) => a.localeCompare(b, 'ar'));
for (const r of roots) {
  if (rootSlugMap[r]) continue;
  const base = rootSlugBase(r);
  let s = base;
  let n = 2;
  while (takenRootSlugs.has(s)) s = `${base}-${n++}`;
  takenRootSlugs.add(s);
  rootSlugMap[r] = s;
}
const publishedRoots = new Set(roots);
const rootSlug = (r) => (publishedRoots.has(r) ? rootSlugMap[r] : null);

const byPage = new Map();
for (const e of words) {
  if (!byPage.has(e.page)) byPage.set(e.page, []);
  byPage.get(e.page).push(e);
}

console.log('Finding corpus examples…');
const corpus = loadCorpus(PUBLIC);
const link = linkCorpusToDictionary(corpus, dict);
const corpusEx = corpusExamples(corpus, link, published, 3);
console.log(`  ${link.size} corpus words linked to the dictionary; examples for ${corpusEx.size} published words`);

const letterCounts = new Map();
for (const e of words) letterCounts.set(firstLetter(e.w), (letterCounts.get(firstLetter(e.w)) || 0) + 1);

// Two published entries with the same spelling and short meaning would get
// the same title: name the part of speech when that differs, otherwise use
// the fuller meaning.
const titleGloss = new Map();
const titlePos = new Set();
{
  const groups = new Map();
  for (const e of words) {
    const k = `${e.w}|${headline(e, 40)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const posDiffers = new Set(list.map((e) => e.pos)).size === list.length;
    list.forEach((e, i) => {
      if (posDiffers) {
        titlePos.add(e.id);
        return;
      }
      const heads = (e.senses || []).map((s) => shortGloss(s.head, 30)).filter(Boolean);
      titleGloss.set(e.id, [...new Set(heads)].slice(0, 2).join(', ') || `sense ${i + 1}`);
    });
  }
}

const ctx = {
  titleGloss, titlePos,
  dict, wordSlug, rootSlug, corpusEx, byPage, rootMeanings, letterCounts,
  asciiOf: (e) => asciiTranslit(e.rom),
};

// ------------------------------------------------------------------ render

console.log(`Rendering ${words.length} word pages, ${roots.length} root pages…`);
const pages = []; // {path, html, kind}
for (const e of words) pages.push({ ...renderWord(e, ctx), kind: 'words' });
for (const r of roots) pages.push({ ...renderRoot(r, ctx), kind: 'roots' });
for (const roman of FORM_LIST) pages.push({ ...renderForm(roman, ctx), kind: 'pages' });
pages.push({ ...renderRootsHub(roots, ctx), kind: 'pages' });
pages.push({ ...renderFormsHub(), kind: 'pages' });
pages.push({ ...renderGuide(ctx), kind: 'pages' });
pages.push({ ...renderWordsHub(words, ctx), kind: 'pages' });
pages.push({ ...renderMostCommon(words, ctx), kind: 'pages' });
for (const [letter, name] of LETTERS) {
  const list = words.filter((e) => firstLetter(e.w) === letter);
  if (list.length) pages.push({ ...renderLetter(letter, name, list, ctx), kind: 'pages' });
}

const errors = validate(pages, {
  site: SITE,
  extraPaths: ['/', '/auth', '/favicon.svg', '/404.html'],
});
if (errors.length) {
  console.error(`\n✗ ${errors.length} problem(s) in generated pages:`);
  for (const err of errors.slice(0, 40)) console.error(`  ${err}`);
  process.exit(1);
}

// ------------------------------------------------------------------- write

const GENERATED_DIRS = ['word', 'words', 'root', 'roots', 'form', 'forms', 'guide', 'dict'];
for (const d of GENERATED_DIRS) fs.rmSync(path.join(PUBLIC, d), { recursive: true, force: true });

for (const p of pages) {
  const dir = path.join(PUBLIC, p.path);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), p.html);
}
fs.writeFileSync(path.join(PUBLIC, '404.html'), render404());
fs.writeFileSync(path.join(PUBLIC, 'words/search.json'), JSON.stringify(searchIndex(words, ctx)));

// Every entry, not just the published ones, for the app's dictionary screens.
{
  const { index, shards } = appData(dict, { wordSlug });
  fs.mkdirSync(path.join(PUBLIC, 'dict/s'), { recursive: true });
  fs.writeFileSync(path.join(PUBLIC, 'dict/index.json'), JSON.stringify(index));
  shards.forEach((s, n) => fs.writeFileSync(path.join(PUBLIC, `dict/s/${n}.json`), JSON.stringify(s)));
  console.log(`  app dictionary: ${index.length} entries in ${shards.length} shards`);
}

// ------------------------------------------- lastmod, sitemaps and IndexNow

/**
 * lastmod should say when a page's content last changed, not when the site was
 * last built, or search engines learn to ignore it. Each page's hash is
 * published in /seo-manifest.json; on a Netlify build we fetch the live copy,
 * keep the old date for unchanged pages, and list the changed ones in
 * /indexnow-pending.json for netlify/functions/deploy-succeeded.mjs to submit.
 */
const today = new Date().toISOString().slice(0, 10);
let previous = {};
if (process.env.NETLIFY === 'true') {
  try {
    const res = await fetch(`${SITE}/seo-manifest.json`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) previous = await res.json();
  } catch (err) {
    console.log(`  (no previous manifest: ${err.message})`);
  }
}
const homeHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(REPO, 'index.html'))).digest('hex').slice(0, 16);
const manifest = {};
const changed = [];
const entries = [{ path: '/', hash: homeHash, kind: 'pages' },
  ...pages.map((p) => ({ path: p.path, kind: p.kind, hash: crypto.createHash('sha1').update(p.html).digest('hex').slice(0, 16) }))];
for (const { path: p, hash } of entries) {
  const prev = previous[p];
  const unchanged = prev && prev[0] === hash;
  manifest[p] = [hash, unchanged ? prev[1] : today];
  if (!unchanged) changed.push(`${SITE}${p}`);
}
fs.writeFileSync(path.join(PUBLIC, 'seo-manifest.json'), JSON.stringify(manifest));
fs.writeFileSync(path.join(PUBLIC, 'indexnow-pending.json'), JSON.stringify({ generated: today, urls: changed }));

const sitemapFiles = [];
for (const kind of ['pages', 'roots', 'words']) {
  const list = entries.filter((x) => x.kind === kind);
  for (let i = 0; i < list.length; i += 40000) {
    const name = `sitemap-${kind}${i ? `-${i / 40000 + 1}` : ''}.xml`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${list.slice(i, i + 40000).map((x) => `<url><loc>${SITE}${x.path}</loc><lastmod>${manifest[x.path][1]}</lastmod></url>`).join('\n')}
</urlset>
`;
    fs.writeFileSync(path.join(PUBLIC, name), xml);
    sitemapFiles.push(name);
  }
}
fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapFiles.map((f) => `<sitemap><loc>${SITE}/${f}</loc><lastmod>${today}</lastmod></sitemap>`).join('\n')}
</sitemapindex>
`);

fs.writeFileSync(WORD_SLUGS, `${JSON.stringify(slugMap, Object.keys(slugMap).sort(), 1)}\n`);
fs.writeFileSync(ROOT_SLUGS, `${JSON.stringify(rootSlugMap, null, 2)}\n`);

console.log(`\n✅ ${pages.length + 1} pages (${words.length} words, ${roots.length} roots), ${sitemapFiles.length} sitemaps`);
console.log(`   ${changed.length} new or changed since the live site`);
console.log(`   canonical origin: ${SITE}`);
