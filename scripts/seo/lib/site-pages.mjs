/** Root pages, verb-form pages, hubs, the guide and the 404 page. */
import { esc, shortGloss, rootSlugBase, normalizeArabic, stripDiacritics, ROMAN_TO_NUM } from './text.mjs';
import { shell, speakButton, BRAND, APP_PATH, SITE, CREDIT_WIKTIONARY, CREDIT_FREQUENCY } from './layout.mjs';
import { family, mainGloss, headline, POS_LABEL } from './dictionary.mjs';
import { FORMS, FORM_LIST } from './forms.mjs';

const ROLE_LABEL = {
  'verbal noun': 'Verbal noun', 'active participle': 'Active participle',
  'passive participle': 'Passive participle', 'from this verb': 'Derived noun',
};

function linker(ctx) {
  return (x, text = x.w) => {
    const s = ctx.wordSlug(x);
    return s ? `<a href="/word/${s}/" class="ar">${esc(text)}</a>` : `<span class="ar">${esc(text)}</span>`;
  };
}

// --------------------------------------------------------------- root page

export function renderRoot(root, ctx) {
  const slug = ctx.rootSlug(root);
  const path = `/root/${slug}/`;
  const latin = rootSlugBase(root);
  const fam = family(ctx.dict, root);
  const link = linker(ctx);
  const formI = fam.groups.find((g) => g.verb.form === 'I')?.verb;
  const curated = ctx.rootMeanings[root];
  const core = curated
    ? `Core idea: <strong>${esc(curated)}</strong>`
    : formI ? `Form I verb ${link(formI)}: <strong>${esc(headline(formI, 60))}</strong>` : '';

  const all = [...fam.groups.flatMap((g) => [g.verb, ...g.connected.map((c) => c.entry).filter(Boolean)]), ...fam.others];
  const common = all.filter((x) => x.freq > 0).sort((a, b) => b.freq - a.freq).slice(0, 8);
  const forms = fam.groups.map((g) => g.verb.form).filter(Boolean);

  const groupsHtml = fam.groups.map((g) => {
    const v = g.verb;
    const f = FORMS[v.form];
    return `<div class="card">
<div class="verb-line"><div><span class="lemma">${link(v)}</span> ${speakButton(v.w, { small: true, audio: v.audio })}
${v.present?.[0] ? `<span class="sub"> · present <span class="ar">${esc(v.present[0])}</span></span>` : ''}</div>
<div class="sub">${ROMAN_TO_NUM[v.form] ? `<a href="/form/${ROMAN_TO_NUM[v.form]}/">Form ${esc(v.form)}</a>` : `Form ${esc(v.form || '')}`}${f ? ` · ${esc(f.summary)}` : ''}</div></div>
<p>${esc((v.senses || []).slice(0, 3).map((s) => s.head).join('; '))}</p>
${g.connected.length ? `<div class="conn">${g.connected.map((c) => `<div class="entry">
<div><div class="lemma">${c.entry ? link(c.entry) : `<span class="ar">${esc(c.word)}</span>`}</div><div class="meta">${esc(ROLE_LABEL[c.role] || c.role)}</div></div>
<div class="gloss">${c.entry ? esc(headline(c.entry, 60)) : ''}</div></div>`).join('')}</div>` : ''}
</div>`;
  }).join('');

  const othersHtml = fam.others.length ? `<h2>${fam.groups.length ? 'Other nouns and adjectives' : 'Nouns and adjectives'}</h2>
<div class="card">${fam.others.map((x) => `<div class="entry">
<div><div class="lemma">${link(x)}</div><div class="meta">${esc(POS_LABEL[x.pos] || x.pos)}</div></div>
<div class="gloss">${esc(headline(x, 60))}</div></div>`).join('')}</div>` : '';

  const body = `
<div class="rootline ar">${esc(root)}</div>
<h1>The Arabic root <span class="ar">${esc(root)}</span> (${esc(latin)})</h1>
${core ? `<p class="sub">${core}</p>` : ''}
<p>${fam.size} words in the dictionary are built from <span class="ar">${esc(root)}</span>${forms.length ? `, including verbs in ${forms.length === 1 ? 'Form' : 'Forms'} ${esc([...new Set(forms)].join(', '))}` : ''}.
Each verb is listed with the nouns that come from it: its verbal noun (masdar), its participles, and words derived from it.</p>
${common.length ? `<h2>Most common</h2><div class="hl">${common.map((x) => `<div class="kf"><div class="k">${esc(x.pos === 'verb' ? `Verb · Form ${x.form || ''}` : POS_LABEL[x.pos] || x.pos)}</div><div class="v">${link(x)}</div><div class="g">${esc(headline(x, 48))}</div></div>`).join('')}</div>` : ''}
${fam.groups.length ? `<h2>Verbs and the nouns that come from them</h2>${groupsHtml}` : ''}
${othersHtml}
<h2>Practise this root</h2>
<p>Turn these words into flashcards and drill them with spaced repetition in ${BRAND}.</p>
<p><a class="cta" href="${APP_PATH}">Start learning free</a></p>`;

  const g = curated || (formI ? headline(formI, 40) : '');
  const title = `${root} (${latin}): Arabic root meaning & all ${fam.size} words from it | ${BRAND}`;
  const description = `${g ? `The Arabic root ${root} (${latin}): ${g}. ` : `The Arabic root ${root} (${latin}). `}All ${fam.size} words built from it, verbs by form with their verbal nouns and participles, with meanings and plurals.`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    name: `Arabic root ${root} (${latin})`,
    description: g || `Words derived from the Arabic root ${root}`,
    url: `${SITE}${path}`,
    hasDefinedTerm: all.slice(0, 30).map((x) => ({
      '@type': 'DefinedTerm',
      name: x.w,
      description: headline(x, 80),
      ...(ctx.wordSlug(x) ? { url: `${SITE}/word/${ctx.wordSlug(x)}/` } : {}),
    })),
  };
  return {
    path,
    html: shell({
      title, description, path, body, jsonLd,
      crumbs: [['Roots', '/roots/'], [root, path]],
      credits: [CREDIT_WIKTIONARY(''), CREDIT_FREQUENCY],
    }),
  };
}

// --------------------------------------------------------------- form pages

export function renderForm(roman, ctx) {
  const n = ROMAN_TO_NUM[roman];
  const f = FORMS[roman];
  const path = `/form/${n}/`;
  const link = linker(ctx);
  const verbs = ctx.dict.entries
    .filter((e) => e.pos === 'verb' && e.form === roman && e.root && e.senses?.length)
    .sort((a, b) => b.freq - a.freq);
  const shown = verbs.slice(0, 80);

  const body = `
<div class="rootline ar">${esc(f.pattern)}</div>
<h1>Arabic Verb Form ${roman}: ${esc(f.summary)}</h1>
<p>${esc(f.detail)}</p>
<div class="card">
<p><strong>Pattern:</strong> <span class="ar">${esc(f.pattern)}</span><br>
<strong>What it does:</strong> ${esc(f.summary)}<br>
<strong>In the dictionary:</strong> ${verbs.length} Form ${roman} verbs</p>
</div>
<h2>How to recognise it</h2>
<p>Every Arabic verb form is described by weighing it against the template root
<span class="ar">ف-ع-ل</span>. Form ${roman} is written <span class="ar">${esc(f.pattern)}</span>,
so any root poured into that same shape behaves the same way. That template is the
word's <em>wazn</em>, its measure.</p>
<h2>The most common Form ${roman} verbs</h2>
<p class="sub">${shown.length} of ${verbs.length}, most common first, each with its present tense and root.</p>
<div class="card">
${shown.map((v) => `<div class="entry">
<div><div class="lemma">${link(v)}${v.present?.[0] ? ` <span class="sub ar">${esc(v.present[0])}</span>` : ''}</div>
<div class="meta">${ctx.rootSlug(v.root) ? `<a href="/root/${ctx.rootSlug(v.root)}/">Root <span class="ar">${esc(v.root)}</span></a>` : `Root <span class="ar">${esc(v.root)}</span>`}</div></div>
<div class="gloss">${esc(headline(v, 60))}</div></div>`).join('')}
</div>
<h2>Practise Form ${roman}</h2>
<p>Drill these verbs with spaced repetition, or run a conjugation drill on Form ${roman} only.</p>
<p><a class="cta" href="${APP_PATH}">Start learning free</a></p>
<h2>The other forms</h2>
<p>${FORM_LIST.filter((r) => r !== roman).map((r) => `<a class="pill" href="/form/${ROMAN_TO_NUM[r]}/">Form ${r}</a>`).join('')}</p>`;

  return {
    path,
    html: shell({
      title: `Arabic Verb Form ${roman} (${f.pattern}): meaning, pattern & ${verbs.length} verbs | ${BRAND}`,
      description: `Form ${roman} follows the pattern ${f.pattern}: ${f.summary.toLowerCase()}. ${f.detail} See the most common Form ${roman} verbs with meanings and conjugations.`,
      path, body,
      jsonLd: { '@context': 'https://schema.org', '@type': 'Article', headline: `Arabic Verb Form ${roman} (${f.pattern})`, description: f.detail, url: `${SITE}${path}` },
      crumbs: [['Verb forms', '/forms/'], [`Form ${roman}`, path]],
      credits: [CREDIT_WIKTIONARY(''), CREDIT_FREQUENCY],
    }),
  };
}

// --------------------------------------------------------------------- hubs

export function renderRootsHub(roots, ctx) {
  const path = '/roots/';
  const byLetter = new Map();
  for (const r of roots) {
    const l = normalizeArabic(r[0]);
    if (!byLetter.has(l)) byLetter.set(l, []);
    byLetter.get(l).push(r);
  }
  const letters = [...byLetter.keys()].sort((a, b) => a.localeCompare(b, 'ar'));
  const body = `
<h1>Arabic roots</h1>
<p>Almost every Arabic word is built from a short skeleton of consonants, usually three.
Learn the root and you unlock a whole family of related words at once. Each root below lists
every word built from it, verbs by form with the nouns that come from them.</p>
<p class="letters">${letters.map((l) => `<a class="pill ar" href="#r-${encodeURIComponent(l)}">${esc(l)}</a>`).join('')}</p>
${letters.map((l) => `<h2 id="r-${encodeURIComponent(l)}" class="ar">${esc(l)}</h2><div class="card">${byLetter.get(l)
    .sort((a, b) => a.localeCompare(b, 'ar'))
    .map((r) => {
      const fam = family(ctx.dict, r);
      const v = fam.groups.find((g) => g.verb.form === 'I')?.verb || fam.groups[0]?.verb || fam.others[0];
      return `<div class="entry"><div><div class="lemma ar"><a href="/root/${ctx.rootSlug(r)}/">${esc(r)}</a></div>
<div class="meta">${fam.size} words</div></div><div class="gloss">${esc(ctx.rootMeanings[r] || (v ? headline(v, 50) : ''))}</div></div>`;
    }).join('')}</div>`).join('')}`;
  return {
    path,
    html: shell({
      title: `Arabic roots: ${roots.length} roots with every word built from them | ${BRAND}`,
      description: `Browse ${roots.length} Arabic roots. Each shows every verb by form, with its verbal noun and participles, plus the nouns and adjectives from the same root.`,
      path, body, crumbs: [['Home', '/'], ['Roots', path]],
      credits: [CREDIT_WIKTIONARY('')],
    }),
  };
}

export function renderFormsHub() {
  const path = '/forms/';
  const body = `
<h1>The ten Arabic verb forms</h1>
<p>Arabic verbs are made by pouring a root into one of ten templates. Each template (each
<em>wazn</em>) shifts the root's meaning in a predictable way: making it causative,
reflexive, mutual, or something else. Learn the ten patterns and you can often guess a verb's
meaning from a root you already know.</p>
<div class="card">
${FORM_LIST.map((r) => `<div class="entry">
<div><div class="lemma ar"><a href="/form/${ROMAN_TO_NUM[r]}/">${esc(FORMS[r].pattern)}</a></div>
<div class="meta">Form ${r}</div></div>
<div class="gloss">${esc(FORMS[r].summary)}</div></div>`).join('')}
</div>
<p><a class="cta" href="${APP_PATH}">Drill verb forms in ${BRAND}</a></p>`;
  return {
    path,
    html: shell({
      title: `The 10 Arabic verb forms: patterns, meanings & examples | ${BRAND}`,
      description: 'All ten Arabic verb forms explained: the pattern each follows, how it changes a root\'s meaning, and the most common verbs in every form.',
      path, body, crumbs: [['Home', '/'], ['Verb forms', path]],
    }),
  };
}

export function renderGuide(ctx) {
  const ktb = ctx.rootSlug('ك-ت-ب');
  const path = '/guide/arabic-root-system/';
  const body = `
<h1>How the Arabic root system works</h1>
<p>Arabic builds its vocabulary differently from English. Instead of stringing prefixes and
suffixes onto whole words, it threads a skeleton of consonants (the <strong>root</strong>)
through a set of vowel-and-affix templates called <strong>patterns</strong>, or <em>awzān</em>.</p>
<h2>Roots</h2>
<p>A root is usually three consonants and carries an abstract idea rather than a specific
word. The root <span class="ar">ك-ت-ب</span> is about <em>writing</em>. On its own it is not a
word you can say; it is raw material.</p>
<h2>Patterns</h2>
<p>Pour a root into a pattern and you get a real word. The same <span class="ar">ك-ت-ب</span>
gives ${ktb ? `<a href="/root/${ktb}/">` : ''}a verb meaning <em>he wrote</em>, a noun meaning <em>book</em>, another
meaning <em>office</em> or <em>desk</em>, and a word for <em>writer</em>${ktb ? '</a>' : ''}. Each is the root in a
different mould, and the mould supplies the grammatical idea: an action, a place, a doer.</p>
<h2>Why this matters for learners</h2>
<p>Vocabulary stops being a flat list to memorise one item at a time. Meet one word and you
have partial access to a dozen relatives. A learner who notices that a new word shares a root
with something familiar can often guess its meaning before reaching for a dictionary.</p>
<h2>The verb forms</h2>
<p>Verbs are the most regular case. Arabic has ten common verb patterns, numbered with Roman
numerals, and each shifts meaning in a predictable way: Form II tends to be causative or
intensive, Form VII passive, Form X about seeking or considering.</p>
<p>${FORM_LIST.map((r) => `<a class="pill" href="/form/${ROMAN_TO_NUM[r]}/">Form ${r}</a>`).join('')}</p>
<h2>Try it</h2>
<p>Look up any word in the <a href="/words/">dictionary</a> and open its <em>Root family</em> tab to
see every relative, verbs by form with their nouns underneath.</p>
<p><a class="cta" href="${APP_PATH}">Start learning free</a></p>`;
  return {
    path,
    html: shell({
      title: `How the Arabic root & pattern system works | ${BRAND}`,
      description: 'Arabic builds words by threading a three-consonant root through vowel patterns. A plain-English explanation of roots, patterns and the ten verb forms, with examples.',
      path, body, crumbs: [['Home', '/'], ['Guide', path]],
    }),
  };
}

// ------------------------------------------------------------ dictionary hub

export const LETTERS = [
  ['ا', 'alif'], ['ب', 'ba'], ['ت', 'ta'], ['ث', 'tha'], ['ج', 'jim'], ['ح', 'haa'], ['خ', 'kha'],
  ['د', 'dal'], ['ذ', 'dhal'], ['ر', 'ra'], ['ز', 'zay'], ['س', 'sin'], ['ش', 'shin'], ['ص', 'sad'],
  ['ض', 'dad'], ['ط', 'taa'], ['ظ', 'zaa'], ['ع', 'ayn'], ['غ', 'ghayn'], ['ف', 'fa'], ['ق', 'qaf'],
  ['ك', 'kaf'], ['ل', 'lam'], ['م', 'mim'], ['ن', 'nun'], ['ه', 'ha'], ['و', 'waw'], ['ي', 'ya'],
];

export function firstLetter(w) {
  const c = normalizeArabic(w)[0];
  if (c === 'ء' || c === 'ئ' || c === 'ؤ') return 'ا';
  return c;
}

const SEARCH_JS = `
(function(){var q=document.getElementById('q'),out=document.getElementById('results'),data=null;
function norm(s){return s.replace(/[\\u064B-\\u0652\\u0670\\u0640]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').trim().toLowerCase();}
function run(){var v=norm(q.value);if(!v){out.innerHTML='';return;}
var ar=/[\\u0621-\\u064A]/.test(v),hits=[];
for(var i=0;i<data.length&&hits.length<30;i++){var d=data[i];
if(ar?d[2].indexOf(v)===0:(d[3].indexOf(v)===0||(' '+d[4]).indexOf(' '+v)!==-1))hits.push(d);}
out.innerHTML=hits.length?hits.map(function(d){return '<div class="entry"><div class="lemma"><a class="ar" href="/word/'+d[0]+'/">'+d[1]+'</a></div><div class="gloss">'+d[4]+'</div></div>';}).join(''):'<p class="sub">No match yet. Try fewer letters, or the English meaning.</p>';}
q.addEventListener('input',function(){if(data)return run();fetch('/words/search.json').then(function(r){return r.json()}).then(function(j){data=j;run();});});
})();`.trim();

export function renderWordsHub(words, ctx) {
  const path = '/words/';
  const counts = new Map();
  for (const e of words) counts.set(firstLetter(e.w), (counts.get(firstLetter(e.w)) || 0) + 1);
  const body = `
<h1>Arabic–English dictionary</h1>
<p>${words.length.toLocaleString('en')} Arabic words with their meanings, example sentences,
plurals, verb conjugations and the other words from the same root. Type an Arabic word
(with or without vowels), its English meaning, or how it sounds.</p>
<input id="q" type="search" placeholder="كتاب, book, kitab …" aria-label="Search the dictionary" autocomplete="off">
<div id="results" class="card" aria-live="polite"></div>
<p><a class="cta ghost" href="/words/most-common/">The most common Arabic words →</a></p>
<h2>Browse by letter</h2>
<p class="letters">${LETTERS.filter(([l]) => counts.get(l)).map(([l, n]) => `<a class="pill ar" href="/words/${n}/" title="${counts.get(l)} words">${l}</a>`).join('')}</p>
<h2>Browse by root or verb form</h2>
<p><a class="pill" href="/roots/">All roots</a>${FORM_LIST.map((r) => `<a class="pill" href="/form/${ROMAN_TO_NUM[r]}/">Form ${r}</a>`).join('')}</p>
<script>${SEARCH_JS}</script>`;
  return {
    path,
    html: shell({
      title: `Arabic–English dictionary: meanings, plurals, roots & conjugations | ${BRAND}`,
      description: `Look up ${words.length.toLocaleString('en')} Arabic words: English meanings with example sentences, plurals, full verb conjugations, and every word from the same root.`,
      path, body, crumbs: [['Home', '/'], ['Dictionary', path]],
      credits: [CREDIT_WIKTIONARY('')],
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'WebSite', url: `${SITE}/`, name: BRAND,
      },
    }),
  };
}

export function searchIndex(words, ctx) {
  return words.map((e) => [
    ctx.wordSlug(e), e.w, normalizeArabic(e.w),
    ctx.asciiOf(e), headline(e, 50).toLowerCase(),
  ]);
}

export function renderLetter(letter, name, words, ctx) {
  const path = `/words/${name}/`;
  const sorted = words.slice().sort((a, b) => stripDiacritics(a.w).localeCompare(stripDiacritics(b.w), 'ar') || b.freq - a.freq);
  const link = linker(ctx);
  const body = `
<h1>Arabic words starting with <span class="ar">${esc(letter)}</span></h1>
<p>${sorted.length} words beginning with the letter <span class="ar">${esc(letter)}</span> (${esc(name)}), in alphabetical order.</p>
<p class="letters">${LETTERS.filter(([l]) => ctx.letterCounts.get(l)).map(([l, n]) => (l === letter ? `<span class="pill ar" aria-current="page">${l}</span>` : `<a class="pill ar" href="/words/${n}/">${l}</a>`)).join('')}</p>
<div class="card">${sorted.map((e) => `<div class="entry"><div><div class="lemma">${link(e)}</div><div class="meta">${esc(POS_LABEL[e.pos] || e.pos)}${e.form ? ` · Form ${esc(e.form)}` : ''}</div></div>
<div class="gloss">${esc(headline(e, 60))}</div></div>`).join('')}</div>`;
  return {
    path,
    html: shell({
      title: `Arabic words starting with ${letter} (${name}) | ${BRAND} dictionary`,
      description: `${sorted.length} Arabic words that begin with ${letter} (${name}), each with its meaning, plural or conjugation, and root.`,
      path, body, crumbs: [['Dictionary', '/words/'], [`${letter} (${name})`, path]],
      credits: [CREDIT_WIKTIONARY('')],
    }),
  };
}

export function renderMostCommon(words, ctx, limit = 500) {
  const path = '/words/most-common/';
  const top = words.slice().sort((a, b) => b.freq - a.freq).slice(0, limit);
  const link = linker(ctx);
  const body = `
<h1>The ${top.length} most common Arabic words</h1>
<p>Content words (nouns, verbs, adjectives) ranked by how often they appear in a large corpus of
modern Arabic subtitles, each linked to its full entry with plurals, conjugations and root.
Learn these first: they cover a large share of everyday Arabic.</p>
<div class="card">${top.map((e, i) => `<div class="entry"><div><div class="lemma"><span class="sub">${i + 1}.</span> ${link(e)}</div>
<div class="meta">${esc(POS_LABEL[e.pos] || e.pos)}${e.form ? ` · Form ${esc(e.form)}` : ''}</div></div>
<div class="gloss">${esc(headline(e, 60))}</div></div>`).join('')}</div>
<p><a class="cta" href="${APP_PATH}">Turn these into flashcards</a></p>`;
  return {
    path,
    html: shell({
      title: `The ${top.length} most common Arabic words (with meanings) | ${BRAND}`,
      description: `The ${top.length} most frequently used Arabic nouns, verbs and adjectives, ranked by real usage, each with its meaning, plural or conjugation, and root.`,
      path, body, crumbs: [['Dictionary', '/words/'], ['Most common', path]],
      credits: [CREDIT_WIKTIONARY(''), CREDIT_FREQUENCY],
    }),
  };
}

export function render404() {
  const body = `
<h1>Page not found</h1>
<p>There is no page at this address. It may have moved, or the link may be mistyped.</p>
<p><a class="cta" href="/words/">Search the dictionary</a> <a class="cta ghost" href="/roots/">Browse roots</a></p>`;
  return shell({
    title: `Page not found | ${BRAND}`,
    description: 'This page does not exist.',
    path: '/404.html', body, noindex: true,
  });
}
