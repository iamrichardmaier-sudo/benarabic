#!/usr/bin/env node
/**
 * Wazn — static SEO page generator.
 *
 * Emits standalone, crawlable HTML into public/ (Vite copies public/ verbatim
 * into dist/). Deliberately NOT React SSR: the app is client-rendered and sits
 * behind auth, so rendering these through the app would mean fighting the auth
 * context and shipping JS-dependent content to crawlers. Plain HTML generated
 * from data we already hold is both safer and better for indexing, and it
 * touches zero application code.
 *
 * Data sources (all local — no database credentials needed at build time):
 *   - public/bible/word-skeleton-index.json  root/lemma/pos/form/gloss
 *   - public/bible/<book>/<chapter>.json     attested verses (Arabic + English)
 *   - scripts/seo/root-meanings.json         curated root glosses
 *
 * Run:  node scripts/seo/generate.mjs [--roots N]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '../..');
const PUBLIC = path.join(REPO, 'public');

// Update once the custom domain is live; everything canonical keys off this.
const SITE = process.env.SITE_URL || 'https://wazn.app';
const BRAND = 'Wazn';
const APP_PATH = '/'; // the interactive app (study tool) lives at the root

// Mirrors src/lib/analytics.ts. Static pages live outside the React app, so
// they need their own snippet. Unset -> nothing is emitted and no tracker ships.
const GA_ID = process.env.VITE_GA_MEASUREMENT_ID || '';
const GA_SNIPPET = GA_ID
  ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${GA_ID}');</script>`
  : '';

const argRoots = Number(
  (process.argv.find((a) => a.startsWith('--roots=')) || '').split('=')[1] || 25,
);

// ---------------------------------------------------------------- utilities

const TRANSLIT = {
  'ء': 'a', 'آ': 'a', 'أ': 'a', 'إ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's',
  'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f',
  'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w', 'ي': 'y',
  'ى': 'y', 'ة': 'h', 'ئ': 'a', 'ؤ': 'a',
};

function translitLetter(ch) {
  return TRANSLIT[ch] ?? '';
}

/** URL slug for a root: "ك-ت-ب" -> "k-t-b". */
function rootSlugBase(root) {
  return root
    .split('-')
    .map((seg) => [...seg].map(translitLetter).join(''))
    .filter(Boolean)
    .join('-');
}

const DIACRITICS = /[ً-ٰٟـ]/g;
function stripDiacritics(s) {
  return s.replace(DIACRITICS, '');
}
function normalizeArabic(s) {
  return stripDiacritics(s)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const POS_LABEL = {
  verb: 'Verb', noun: 'Noun', adjective: 'Adjective', participle: 'Participle',
  proper_noun: 'Proper noun', particle: 'Particle', other: 'Word',
};

const FORM_ORDER = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
const ROMAN_TO_NUM = Object.fromEntries(FORM_ORDER.map((r, i) => [r, i + 1]));

// Mirrors src/lib/morphology.ts VERB_FORM_GLOSSES so the generator stays
// dependency-free (no TS import at build time).
const FORMS = {
  I:    { pattern: 'فَعَلَ',    summary: 'The plain action',
          detail: 'The base form. It carries the root idea with nothing added — whatever the root means at its simplest.' },
  II:   { pattern: 'فَعَّلَ',   summary: 'Causative or intensive',
          detail: 'Doubling the middle letter either makes someone else do the action, or makes it thorough and repeated.' },
  III:  { pattern: 'فاعَلَ',   summary: 'Done to or with someone',
          detail: 'Stretching the first vowel points the action at another party — you do it to them, or alongside them.' },
  IV:   { pattern: 'أَفعَلَ',   summary: 'Causative',
          detail: 'A prefixed hamza makes something or someone undergo the root action. Often blunter and more transitive than Form II.' },
  V:    { pattern: 'تَفَعَّلَ',  summary: 'Reflexive of Form II',
          detail: 'Form II with a تَ in front: the action turns back on the doer, or is undergone gradually.' },
  VI:   { pattern: 'تَفاعَلَ',  summary: 'Mutual action',
          detail: 'Form III with a تَ in front: two or more parties doing it to each other.' },
  VII:  { pattern: 'اِنفَعَلَ',  summary: 'Passive or resultative',
          detail: 'The subject undergoes the action, often with no agent named — it simply happens to them.' },
  VIII: { pattern: 'اِفتَعَلَ',  summary: 'Reflexive, often idiomatic',
          detail: 'An infixed ت. Frequently the action done for oneself or to oneself, though many Form VIII verbs drift into their own meanings.' },
  IX:   { pattern: 'اِفعَلَّ',   summary: 'Colours and defects',
          detail: 'A narrow form, almost entirely used for becoming a colour or acquiring a bodily defect.' },
  X:    { pattern: 'اِستَفعَلَ', summary: 'Seeking or considering',
          detail: 'The اِست prefix means asking for the root action, or regarding something as having that quality.' },
};

// ------------------------------------------------------------------- load

console.log('Loading data…');

const skeletonIndex = JSON.parse(
  fs.readFileSync(path.join(PUBLIC, 'bible/word-skeleton-index.json'), 'utf8'),
);
const rootMeanings = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'root-meanings.json'), 'utf8'),
);
const books = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'bible/books.json'), 'utf8'));
const bookNames = Object.fromEntries(books.map((b) => [b.code, b.name]));

// root -> Map(lemma -> {lemma,pos,verbForm,gloss,skel})
const byRoot = new Map();
// skeleton -> root (for verse scanning)
const skelToRoot = new Map();

for (const [skel, senses] of Object.entries(skeletonIndex)) {
  for (const s of senses) {
    if (!s.root) continue;
    if (!skelToRoot.has(skel)) skelToRoot.set(skel, s.root);
    if (!byRoot.has(s.root)) byRoot.set(s.root, new Map());
    const m = byRoot.get(s.root);
    if (!m.has(s.lemma)) {
      m.set(s.lemma, {
        lemma: s.lemma, pos: s.pos, verbForm: s.verbForm || null,
        gloss: s.gloss, skel,
      });
    }
  }
}

// -------------------------------------------------- attested example verses

/** One short verse per root, scanned from the local Bible chapter files.
 *  Short verses make better illustrations than long ones, so we keep the
 *  shortest qualifying verse we encounter. */
console.log('Scanning corpus for attested examples…');
const exampleByRoot = new Map();

for (const book of books) {
  for (let ch = 1; ch <= book.chapters; ch++) {
    const file = path.join(PUBLIC, 'bible', book.code, `${ch}.json`);
    if (!fs.existsSync(file)) continue;
    let verses;
    try {
      verses = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      continue;
    }
    for (const v of verses) {
      if (!v.a || !v.e) continue;
      const len = v.a.length;
      if (len < 30 || len > 190) continue; // usable illustration length
      const seen = new Set();
      for (const w of v.a.split(/\s+/)) {
        const key = normalizeArabic(w.replace(/^[.,،؛:؟!"«»()]+|[.,،؛:؟!"«»()]+$/g, ''));
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const root = skelToRoot.get(key);
        if (!root) continue;
        const prev = exampleByRoot.get(root);
        if (!prev || len < prev.len) {
          exampleByRoot.set(root, {
            len, arabic: v.a, english: v.e, word: key,
            ref: `${bookNames[book.code] ?? book.code} ${ch}:${v.v}`,
          });
        }
      }
    }
  }
}
console.log(`  found examples for ${exampleByRoot.size} roots`);

// ------------------------------------------------------ select & slug roots

const SLUG_FILE = path.join(__dirname, 'root-slugs.json');
const slugMap = fs.existsSync(SLUG_FILE)
  ? JSON.parse(fs.readFileSync(SLUG_FILE, 'utf8'))
  : {};

/** Slugs are persisted once assigned so published URLs never shift. */
function slugFor(root) {
  if (slugMap[root]) return slugMap[root];
  const base = rootSlugBase(root);
  const taken = new Set(Object.values(slugMap));
  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;
  slugMap[root] = slug;
  return slug;
}

// Quality bar: >=3 distinct lemmas AND (curated gloss OR >=5 lemmas).
// A zero-authority domain cannot afford thin pages, so we take fewer, better.
const candidates = [...byRoot.entries()]
  .map(([root, lemmas]) => ({
    root,
    lemmas: [...lemmas.values()],
    meaning: rootMeanings[root] || null,
    example: exampleByRoot.get(root) || null,
  }))
  .filter((r) => r.lemmas.length >= 3 && (r.meaning || r.lemmas.length >= 5))
  .sort((a, b) => {
    if (!!b.meaning !== !!a.meaning) return b.meaning ? 1 : -1;
    return b.lemmas.length - a.lemmas.length;
  });

const selectedRoots = candidates.slice(0, argRoots);
selectedRoots.forEach((r) => slugFor(r.root));

// --------------------------------------------------------------- templates

const CSS = `
:root{--bg:hsl(36 33% 97%);--card:hsl(36 40% 95%);--fg:hsl(24 10% 15%);
--muted:hsl(24 8% 45%);--primary:hsl(24 70% 45%);--border:hsl(36 20% 86%)}
@media(prefers-color-scheme:dark){:root{--bg:hsl(24 12% 10%);--card:hsl(24 10% 14%);
--fg:hsl(36 20% 92%);--muted:hsl(36 8% 62%);--primary:hsl(24 75% 58%);--border:hsl(24 10% 24%)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6}
.ar{font-family:"Noto Naskh Arabic","Amiri","Traditional Arabic",serif;direction:rtl}
.wrap{max-width:52rem;margin:0 auto;padding:1.5rem 1.25rem 4rem}
header.site{border-bottom:1px solid var(--border);background:var(--card)}
header.site .wrap{padding:.85rem 1.25rem;display:flex;align-items:center;gap:.75rem}
.brand{display:flex;align-items:center;gap:.55rem;text-decoration:none;color:var(--fg);font-weight:700}
.brand svg{width:26px;height:26px}
nav.site{margin-inline-start:auto;display:flex;gap:1rem;font-size:.9rem}
nav.site a{color:var(--muted);text-decoration:none}
nav.site a:hover{color:var(--primary)}
h1{font-size:1.9rem;line-height:1.25;margin:.2rem 0 .4rem}
h2{font-size:1.25rem;margin:2rem 0 .75rem}
h3{font-size:1rem;margin:1.25rem 0 .4rem}
.rootline{font-size:2.6rem;font-weight:700;letter-spacing:.12em}
.sub{color:var(--muted);font-size:.95rem}
.card{background:var(--card);border:1px solid var(--border);border-radius:1rem;padding:1.1rem;margin:.75rem 0}
.grid{display:grid;gap:.6rem}
.entry{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
padding:.6rem .2rem;border-bottom:1px solid var(--border)}
.entry:last-child{border-bottom:0}
.entry .lemma{font-size:1.3rem;font-weight:600}
.entry .meta{font-size:.78rem;color:var(--primary);font-weight:600}
.entry .gloss{color:var(--muted);font-size:.92rem;text-align:right}
.verse{font-size:1.35rem;margin:.2rem 0 .5rem}
.cta{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;
font-weight:600;padding:.65rem 1.1rem;border-radius:.75rem;margin-top:.5rem}
.pill{display:inline-block;border:1px solid var(--border);border-radius:999px;
padding:.3rem .7rem;margin:.2rem .25rem .2rem 0;font-size:.85rem;text-decoration:none;color:var(--fg)}
.pill:hover{border-color:var(--primary);color:var(--primary)}
a{color:var(--primary)}
footer.site{border-top:1px solid var(--border);margin-top:3rem;padding:1.5rem 0;
font-size:.78rem;color:var(--muted)}
`.trim();

const LOGO_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 5v20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 10h20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M16 27h-6M16 27h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 10l3.5 7a4 4 0 0 0 7 0L17 10" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".55"/><path d="M15 10l3.5 7a4 4 0 0 0 7 0L29 10" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".55"/></svg>`;

function shell({ title, description, canonical, body, jsonLd }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${BRAND}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
${GA_SNIPPET}
</head>
<body>
<header class="site"><div class="wrap">
<a class="brand" href="/"><span style="color:var(--primary)">${LOGO_SVG}</span>${BRAND}</a>
<nav class="site">
<a href="/roots/">Roots</a><a href="/forms/">Verb forms</a><a href="${APP_PATH}">Open the app</a>
</nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="site"><div class="wrap">
<p>${BRAND} — learn Arabic through its roots and patterns.
Word analysis derived from the Smith &amp; Van Dyke Arabic Bible (1865, public domain),
tagged with data from <a href="https://stepbible.org">STEPBible</a> and Arabic Bible Outreach
Ministry, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
English quotations are from the King James Version (public domain).
Texts are presented as language corpora for study.</p>
</div></footer>
</body>
</html>`;
}

function entryRow(w) {
  const meta = [POS_LABEL[w.pos] ?? w.pos, w.verbForm ? `Form ${w.verbForm}` : null]
    .filter(Boolean).join(' · ');
  return `<div class="entry">
<div><div class="lemma ar">${esc(w.lemma)}</div><div class="meta">${esc(meta)}</div></div>
<div class="gloss">${esc(w.gloss)}</div>
</div>`;
}

// ------------------------------------------------------------- root pages

function renderRoot(r) {
  const slug = slugMap[r.root];
  const latin = rootSlugBase(r.root).replace(/-/g, '-');
  const canonical = `${SITE}/root/${slug}/`;
  const count = r.lemmas.length;

  const verbs = r.lemmas.filter((w) => w.pos === 'verb');
  const others = r.lemmas.filter((w) => w.pos !== 'verb');
  const formsPresent = [...new Set(verbs.map((w) => w.verbForm).filter(Boolean))]
    .sort((a, b) => (ROMAN_TO_NUM[a] ?? 99) - (ROMAN_TO_NUM[b] ?? 99));

  const title = `${r.root} (${latin}) — Arabic Root Meaning & Derived Words | ${BRAND}`;
  const description = r.meaning
    ? `The Arabic root ${r.root} carries the sense of ${r.meaning}. See all ${count} words built from it — verbs by form, nouns and participles — each with vocalization, meaning, and a real example.`
    : `All ${count} Arabic words built from the root ${r.root} — verbs by form, nouns and participles — each with vocalization, meaning, and a real example from a vocalized text.`;

  const body = `
<p class="sub"><a href="/roots/">Roots</a> → ${esc(r.root)}</p>
<div class="rootline ar">${esc(r.root)}</div>
<h1>The Arabic root ${esc(r.root)} (${esc(latin)})</h1>
${r.meaning ? `<p class="sub">Core sense: <strong>${esc(r.meaning)}</strong></p>` : ''}
<p>${count} word${count === 1 ? '' : 's'} in this corpus are built from ${esc(r.root)}${
    formsPresent.length
      ? `, spanning verb ${formsPresent.length === 1 ? 'form' : 'forms'} ${formsPresent.join(', ')}`
      : ''
  }. In Arabic, a root is a skeleton of consonants; slotting it into different
patterns (<em>awzān</em>) produces related words with predictable shifts in meaning.</p>

${verbs.length ? `<h2>Verbs from ${esc(r.root)}</h2><div class="card">${verbs.map(entryRow).join('')}</div>` : ''}
${others.length ? `<h2>Nouns, participles and other words</h2><div class="card">${others.map(entryRow).join('')}</div>` : ''}

${r.example ? `<h2>Seen in context</h2>
<div class="card">
<p class="verse ar">${esc(r.example.arabic)}</p>
<p class="sub">${esc(r.example.english)}</p>
<p class="sub"><em>${esc(r.example.ref)}</em></p>
</div>` : ''}

${formsPresent.length ? `<h2>Verb forms represented</h2><p>${
    formsPresent.map((f) => `<a class="pill" href="/form/${ROMAN_TO_NUM[f]}/">Form ${f} — ${esc(FORMS[f]?.summary ?? '')}</a>`).join('')
  }</p>` : ''}

<h2>Practise this root</h2>
<p>Turn any of these words into a flashcard and drill it with spaced repetition,
or read them where they actually occur.</p>
<p><a class="cta" href="${APP_PATH}">Open ${BRAND} →</a></p>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: `Arabic root ${r.root} (${latin})`,
    description: r.meaning || `Words derived from the Arabic root ${r.root}`,
    url: canonical,
    hasDefinedTerm: r.lemmas.slice(0, 25).map((w) => ({
      '@type': 'DefinedTerm',
      name: w.lemma,
      description: w.gloss,
      inDefinedTermSet: canonical,
    })),
  };

  return { slug, html: shell({ title, description, canonical, body, jsonLd }) };
}

// ------------------------------------------------------------- form pages

function renderForm(roman) {
  const n = ROMAN_TO_NUM[roman];
  const f = FORMS[roman];
  const canonical = `${SITE}/form/${n}/`;

  const examples = [];
  for (const [root, lemmas] of byRoot) {
    for (const w of lemmas.values()) {
      if (w.pos === 'verb' && w.verbForm === roman) {
        examples.push({ ...w, root });
      }
    }
  }
  examples.sort((a, b) => a.lemma.localeCompare(b.lemma, 'ar'));
  const shown = examples.slice(0, 40);

  const title = `Arabic Verb Form ${roman} (${f.pattern}) — Meaning, Pattern & ${examples.length} Real Examples | ${BRAND}`;
  const description = `Form ${roman} follows the pattern ${f.pattern} — ${f.summary.toLowerCase()}. ${f.detail} See ${examples.length} Form ${roman} verbs attested in a real vocalized Arabic text.`;

  const body = `
<p class="sub"><a href="/forms/">Verb forms</a> → Form ${roman}</p>
<div class="rootline ar">${esc(f.pattern)}</div>
<h1>Arabic Verb Form ${roman} — ${esc(f.summary)}</h1>
<p>${esc(f.detail)}</p>
<div class="card">
<h3>At a glance</h3>
<p><strong>Pattern:</strong> <span class="ar">${esc(f.pattern)}</span><br>
<strong>Does:</strong> ${esc(f.summary)}<br>
<strong>Attested here:</strong> ${examples.length} verb${examples.length === 1 ? '' : 's'}</p>
</div>

<h2>How to recognise it</h2>
<p>Every Arabic verb form is described by weighing it against the template root
<span class="ar">ف-ع-ل</span>. Form ${roman} is written <span class="ar">${esc(f.pattern)}</span>,
so any root poured into that same shape behaves the same way. That template is
the word's <em>wazn</em> — its measure.</p>

<h2>Form ${roman} verbs in this corpus</h2>
<p class="sub">${shown.length} of ${examples.length} shown, with the root each is built from.</p>
<div class="card">
${shown.map((w) => `<div class="entry">
<div><div class="lemma ar">${esc(w.lemma)}</div>
<div class="meta"><a href="/root/${slugMap[w.root] ?? slugFor(w.root)}/">${esc(w.root)}</a></div></div>
<div class="gloss">${esc(w.gloss)}</div></div>`).join('')}
</div>

<h2>Practise Form ${roman}</h2>
<p>Drill these verbs with spaced repetition, or filter a conjugation drill to Form ${roman} only.</p>
<p><a class="cta" href="${APP_PATH}">Open ${BRAND} →</a></p>

<h2>The other forms</h2>
<p>${FORM_ORDER.filter((r) => r !== roman)
    .map((r) => `<a class="pill" href="/form/${ROMAN_TO_NUM[r]}/">Form ${r}</a>`).join('')}</p>`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Arabic Verb Form ${roman} (${f.pattern})`,
    description: f.detail,
    url: canonical,
  };

  return { n, html: shell({ title, description, canonical, body, jsonLd }) };
}

// -------------------------------------------------------------- hub pages

function renderRootsHub(rootsList) {
  const canonical = `${SITE}/roots/`;
  const body = `
<h1>Arabic roots</h1>
<p>Almost every Arabic word is built from a short skeleton of consonants — usually
three. Learn the root and you unlock a whole family of related words at once.
Below are the roots currently mapped in ${BRAND}, each showing every word built
from it, with meanings and real examples.</p>
<div class="card">
${rootsList.map((r) => `<div class="entry">
<div><div class="lemma ar"><a href="/root/${slugMap[r.root]}/">${esc(r.root)}</a></div>
<div class="meta">${r.lemmas.length} words</div></div>
<div class="gloss">${esc(r.meaning || '')}</div></div>`).join('')}
</div>
<p><a class="cta" href="${APP_PATH}">Study these in ${BRAND} →</a></p>`;
  return shell({
    title: `Arabic Roots — Meanings & Derived Word Families | ${BRAND}`,
    description: `Browse Arabic roots with every word built from each one — verbs by form, nouns and participles, with meanings and real examples from a vocalized text.`,
    canonical, body,
  });
}

function renderFormsHub() {
  const canonical = `${SITE}/forms/`;
  const body = `
<h1>The ten Arabic verb forms</h1>
<p>Arabic verbs are derived by pouring a root into one of ten templates. Each
template — each <em>wazn</em> — shifts the root's meaning in a predictable way:
making it causative, reflexive, mutual, or something else. Learning the ten
patterns means you can often guess a verb's meaning from a root you already know.</p>
<div class="card">
${FORM_ORDER.map((r) => `<div class="entry">
<div><div class="lemma ar"><a href="/form/${ROMAN_TO_NUM[r]}/">${esc(FORMS[r].pattern)}</a></div>
<div class="meta">Form ${r}</div></div>
<div class="gloss">${esc(FORMS[r].summary)}</div></div>`).join('')}
</div>
<p><a class="cta" href="${APP_PATH}">Drill verb forms in ${BRAND} →</a></p>`;
  return shell({
    title: `The 10 Arabic Verb Forms — Patterns, Meanings & Examples | ${BRAND}`,
    description: `All ten Arabic verb forms explained: the pattern each follows, how it changes a root's meaning, and real attested verbs for every form.`,
    canonical, body,
  });
}

function renderGuide() {
  const canonical = `${SITE}/guide/arabic-root-system/`;
  const body = `
<h1>How the Arabic root system works</h1>
<p>Arabic builds its vocabulary differently from English. Instead of stringing
together prefixes and suffixes onto whole words, it threads a skeleton of
consonants — the <strong>root</strong> — through a set of vowel-and-affix
templates called <strong>patterns</strong>, or <em>awzān</em>.</p>

<h2>Roots</h2>
<p>A root is usually three consonants and carries an abstract idea rather than a
specific word. The root <span class="ar">ك-ت-ب</span> means something like
<em>writing</em>. On its own it isn't pronounceable as a word — it's raw material.</p>

<h2>Patterns</h2>
<p>Pour a root into a pattern and you get a real word. The same
<span class="ar">ك-ت-ب</span> gives a verb meaning <em>he wrote</em>, a noun
meaning <em>book</em>, another meaning <em>office</em> or <em>desk</em>, and a
word for <em>writer</em>. Each is the root in a different mould, and the mould
contributes the grammatical sense: an action, a place, a doer.</p>

<h2>Why this matters for learners</h2>
<p>It means vocabulary is not a flat list to be memorised one item at a time.
Meet one word and you have partial access to a dozen relatives. A learner who
notices that a new word shares a root with something familiar can often infer
its meaning before reaching for a dictionary.</p>

<h2>The verb forms</h2>
<p>Verbs are the most systematic case. Arabic has ten common verb patterns,
conventionally numbered with Roman numerals, and each shifts meaning predictably —
Form II tends to be causative or intensive, Form VII passive, Form X about
seeking or considering.</p>
<p>${FORM_ORDER.map((r) => `<a class="pill" href="/form/${ROMAN_TO_NUM[r]}/">Form ${r}</a>`).join('')}</p>

<h2>Practising it</h2>
<p>${BRAND} maps a real, fully-vocalized Arabic text word by word, so every root
comes with its actual attested relatives and real sentences rather than isolated
dictionary entries. Any word can be turned into a spaced-repetition flashcard.</p>
<p><a class="cta" href="${APP_PATH}">Open ${BRAND} →</a></p>
<p><a href="/roots/">Browse roots</a> · <a href="/forms/">Browse verb forms</a></p>`;
  return shell({
    title: `How the Arabic Root & Pattern System Works | ${BRAND}`,
    description: `Arabic builds words by threading a three-consonant root through vowel patterns. A plain-English explanation of roots, patterns and the ten verb forms, with examples.`,
    canonical, body,
  });
}

// ------------------------------------------------------------------ write

function writePage(relDir, html) {
  const dir = path.join(PUBLIC, relDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

console.log(`Generating ${selectedRoots.length} root pages…`);
const urls = [];

for (const r of selectedRoots) {
  const { slug, html } = renderRoot(r);
  writePage(`root/${slug}`, html);
  urls.push({ loc: `${SITE}/root/${slug}/`, priority: '0.8' });
}

console.log('Generating 10 form pages…');
for (const roman of FORM_ORDER) {
  const { n, html } = renderForm(roman);
  writePage(`form/${n}`, html);
  urls.push({ loc: `${SITE}/form/${n}/`, priority: '0.7' });
}

console.log('Generating hub pages…');
writePage('roots', renderRootsHub(selectedRoots));
urls.push({ loc: `${SITE}/roots/`, priority: '0.9' });
writePage('forms', renderFormsHub());
urls.push({ loc: `${SITE}/forms/`, priority: '0.9' });
writePage('guide/arabic-root-system', renderGuide());
urls.push({ loc: `${SITE}/guide/arabic-root-system/`, priority: '0.9' });

// sitemap
const today = new Date().toISOString().slice(0, 10);
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>${SITE}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>
${urls.map((u) => `<url><loc>${u.loc}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>`;
fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), sitemap);

fs.writeFileSync(SLUG_FILE, JSON.stringify(slugMap, null, 2));

console.log(`\n✅ ${urls.length + 1} URLs generated (incl. home) → public/`);
console.log(`   sitemap.xml written with ${urls.length + 1} entries`);
console.log(`   canonical origin: ${SITE}`);
