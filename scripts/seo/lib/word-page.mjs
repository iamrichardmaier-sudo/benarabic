/** The dictionary page for one Arabic word: /word/<slug>/ */
import { esc, vocalKey, shortGloss, asciiTranslit, ROMAN_TO_NUM } from './text.mjs';
import {
  shell, speakButton, BRAND, APP_PATH, SITE,
  CREDIT_WIKTIONARY, CREDIT_BIBLE, CREDIT_FREQUENCY, CREDIT_AUDIO,
} from './layout.mjs';
import { family, groupOf, mainGloss, headline, POS_LABEL } from './dictionary.mjs';
import { FORMS } from './forms.mjs';

const ROLE_LABEL = {
  'verbal noun': 'Verbal noun',
  'active participle': 'Active participle',
  'passive participle': 'Passive participle',
  'from this verb': 'Derived noun',
};

const PRONOUNS = [
  ['1s', 'أَنَا', 'I'], ['2ms', 'أَنْتَ', 'you (m.)'], ['2fs', 'أَنْتِ', 'you (f.)'],
  ['3ms', 'هُوَ', 'he'], ['3fs', 'هِيَ', 'she'], ['2d', 'أَنْتُمَا', 'you two'],
  ['3md', 'هُمَا', 'they two (m.)'], ['3fd', 'هُمَا', 'they two (f.)'], ['1p', 'نَحْنُ', 'we'],
  ['2mp', 'أَنْتُمْ', 'you all (m.)'], ['2fp', 'أَنْتُنَّ', 'you all (f.)'],
  ['3mp', 'هُمْ', 'they (m.)'], ['3fp', 'هُنَّ', 'they (f.)'],
];
const MOODS = [['past', 'Past'], ['present', 'Present'], ['subjunctive', 'Subjunctive'],
  ['jussive', 'Jussive'], ['imperative', 'Imperative']];

/**
 * @param {object} ctx
 *   dict, wordSlug(e) -> slug|null, rootSlug(root) -> slug|null,
 *   corpusEx: Map(id -> examples), byPage: Map(page -> entries)
 */
export function renderWord(e, ctx) {
  const slug = ctx.wordSlug(e);
  const path = `/word/${slug}/`;
  const fam = family(ctx.dict, e.root);
  const gloss = mainGloss(e) || (e.masdarOf?.length ? `verbal noun of ${e.masdarOf[0]}` : '');
  const ascii = asciiTranslit(e.rom);
  const pos = POS_LABEL[e.pos] || e.pos;
  const rootSlug = ctx.rootSlug(e.root);

  const link = (x, text = x.w) => {
    const s = ctx.wordSlug(x);
    return s ? `<a href="/word/${s}/" class="ar">${esc(text)}</a>` : `<span class="ar">${esc(text)}</span>`;
  };
  /** Find this root's entry for an Arabic spelling, to link and gloss it. */
  const lookup = (word) => (ctx.dict.byRoot.get(e.root) || [])
    .filter((x) => vocalKey(x.w) === vocalKey(word))
    .sort((a, b) => b.freq - a.freq)[0] || null;
  const wordOrLink = (word) => {
    const x = lookup(word);
    return x && x.id !== e.id ? link(x, word) : `<span class="ar">${esc(word)}</span>`;
  };

  // ------------------------------------------------------------- header
  const pills = [
    `<span class="pill">${esc(pos)}${e.gender ? ` · ${e.gender === 'm' ? 'masculine' : 'feminine'}` : ''}</span>`,
    e.form ? `<a class="pill" href="${ROMAN_TO_NUM[e.form] ? `/form/${ROMAN_TO_NUM[e.form]}/` : '/forms/'}">Form ${esc(e.form)}</a>` : '',
    rootSlug
      ? `<a class="pill" href="/root/${rootSlug}/">Root <span class="ar">${esc(e.root)}</span></a>`
      : `<span class="pill">Root <span class="ar">${esc(e.root)}</span></span>`,
  ].join('');

  const homographs = (ctx.byPage.get(e.page) || []).filter((x) => x.id !== e.id && ctx.wordSlug(x));
  const alsoSpelled = homographs.length
    ? `<p class="sub">Also written <span class="ar">${esc(e.page)}</span>: ${homographs.slice(0, 6)
      .map((x) => `${link(x)} <span>(${esc(headline(x, 30) || POS_LABEL[x.pos])})</span>`).join(' · ')}</p>`
    : '';

  const header = `
<div class="head">
<div>
<div class="hw"><h1 class="ar" lang="ar">${esc(e.w)}</h1>${speakButton(e.w, { audio: e.audio })}</div>
${gloss ? `<p class="tr">${esc(headline(e, 80) || shortGloss(gloss, 80))}</p>` : ''}
<p>${pills}</p>
</div>
<div><a class="cta" href="/learn/dictionary/${slug}/?add=1" data-app="/learn/dictionary/${slug}/?add=1">+ Add to my flashcards</a></div>
</div>
${alsoSpelled}`;

  // --------------------------------------------------------- highlights
  const keyForms = [];
  const kf = (k, words, g = '') => {
    if (!words?.length) return;
    keyForms.push(`<div class="kf"><div class="k">${esc(k)}</div><div class="v">${words.map(wordOrLink).join('، ')}</div>${g ? `<div class="g">${esc(g)}</div>` : ''}</div>`);
  };
  if (e.pos === 'verb') {
    kf('Present tense', e.present?.slice(0, 1));
    kf(e.masdar?.length > 1 ? 'Verbal nouns' : 'Verbal noun', e.masdar?.slice(0, 3));
    kf('Active participle', e.ap?.slice(0, 1));
    kf('Passive participle', e.pp?.slice(0, 1));
  } else if (e.pos === 'adj') {
    kf('Feminine', e.fem);
    kf('Masculine plural', e.mpl);
    kf('Feminine plural', e.fpl);
    kf('Plural', e.pl);
    kf('Elative', e.elative, 'more / most …');
  } else {
    kf('Plural', e.pl?.slice(0, 1));
    kf(e.pl?.length > 2 ? 'Other plurals' : 'Other plural', e.pl?.slice(1));
    kf('Feminine', e.fem);
    kf('Singular (one)', e.sing);
    kf('Collective', e.coll);
  }
  if (e.masdarOf?.length) {
    const v = lookup(e.masdarOf[0]);
    kf('Verbal noun of', e.masdarOf.slice(0, 2), v ? headline(v, 40) : '');
  }

  const famMembers = [...fam.groups.flatMap((g) => [g.verb, ...g.connected.map((c) => c.entry).filter(Boolean)]), ...fam.others];
  const common = famMembers.filter((x) => x.id !== e.id && (x.senses?.length || x.masdarOf) && x.freq > 0)
    .sort((a, b) => b.freq - a.freq).slice(0, 6);
  const commonHtml = common.map((x) => `<div class="kf"><div class="k">${esc(x.pos === 'verb' && x.form ? `Verb · Form ${x.form}` : POS_LABEL[x.pos] || x.pos)}</div>
<div class="v">${link(x)}</div><div class="g">${esc(headline(x, 48))}</div></div>`).join('');

  const highlights = (keyForms.length || commonHtml) ? `
<section aria-labelledby="hl-h">
<h2 id="hl-h">Highlights</h2>
${keyForms.length ? `<div class="hl">${keyForms.join('')}</div>` : ''}
${commonHtml ? `<h3>Most common words from the same root</h3><div class="hl">${commonHtml}</div>` : ''}
</section>` : '';

  // --------------------------------------------------------- dictionary
  const exHtml = (ex) => `<div class="ex"><span class="ar" lang="ar">${esc(ex.ar)}</span><span class="en">${esc(ex.en)}</span>${ex.ref ? `<span class="ref">${esc(ex.ref.replace(/:$/, ''))}</span>` : ''}</div>`;
  const lbl = (labels) => (labels?.length ? ` <span class="lbl">${esc(labels.join(', '))}</span>` : '');
  let sensesHtml = '';
  if (e.senses?.length) {
    sensesHtml = `<ol class="senses">${e.senses.map((s) => `<li>${esc(s.head)}${lbl(s.labels)}
${(s.ex || []).map(exHtml).join('')}
${s.subs?.length ? `<ol class="subs">${s.subs.map((sub) => `<li>${esc(sub.g)}${lbl(sub.labels)}${(sub.ex || []).map(exHtml).join('')}</li>`).join('')}</ol>` : ''}
</li>`).join('')}</ol>`;
  }
  const masdarNote = e.masdarOf?.length
    ? `<p>Verbal noun of ${e.masdarOf.map((m) => {
      const v = lookup(m);
      return `${wordOrLink(m)}${v ? ` (${esc(headline(v, 50))})` : ''}`;
    }).join(' and ')}: the act or idea of the verb.</p>`
    : '';
  const dictionaryPanel = `
<section id="dictionary" class="panel" role="tabpanel" aria-labelledby="t-dictionary">
<h2>${esc(e.w)} in English</h2>
<p class="sub">${esc(pos)}${e.form ? ` · Form ${esc(e.form)}` : ''}${e.gender ? ` · ${e.gender === 'm' ? 'masculine' : 'feminine'}` : ''}</p>
${masdarNote}
${sensesHtml}
${e.ety ? `<h3>Word origin</h3><p>${esc(e.ety)}</p>` : ''}
</section>`;

  // ------------------------------------------------------------- family
  let familyPanel = '';
  if (fam.size > 1) {
    const mine = groupOf(fam, e);
    const tabs = [];
    const panels = [];
    fam.groups.forEach((g, i) => {
      const id = `fam-${i}`;
      const v = g.verb;
      const selected = mine ? mine === g : i === 0;
      tabs.push(`<button type="button" role="tab" data-tab="${id}" aria-selected="${selected}">Form ${esc(v.form || '?')} · <span class="ar">${esc(v.w)}</span></button>`);
      const vGloss = (v.senses || []).slice(0, 3).map((s) => s.head).join('; ');
      const formInfo = FORMS[v.form];
      panels.push(`<div id="${id}" class="panel card" role="tabpanel">
<div class="verb-line${v.id === e.id ? ' this' : ''}"><div><span class="lemma">${link(v)}</span> ${speakButton(v.w, { small: true, audio: v.audio })}
${v.present?.[0] ? `<span class="sub"> · present <span class="ar">${esc(v.present[0])}</span></span>` : ''}</div>
<div class="sub">Form ${esc(v.form || '')}${formInfo ? ` · ${ROMAN_TO_NUM[v.form] ? `<a href="/form/${ROMAN_TO_NUM[v.form]}/">${esc(formInfo.summary)}</a>` : esc(formInfo.summary)}` : ''}</div></div>
<p>${esc(vGloss)}</p>
${g.connected.length ? `<div class="conn">${g.connected.map((c) => `<div class="entry${c.entry?.id === e.id ? ' this' : ''}">
<div><div class="lemma">${c.entry ? link(c.entry) : `<span class="ar">${esc(c.word)}</span>`}</div><div class="meta">${esc(ROLE_LABEL[c.role] || c.role)}${c.entry && c.entry.pos !== 'noun' ? ` · ${esc(POS_LABEL[c.entry.pos] || '')}` : ''}</div></div>
<div class="gloss">${c.entry ? esc(headline(c.entry, 60)) : ''}</div></div>`).join('')}</div>` : ''}
</div>`);
    });
    if (fam.others.length) {
      const id = 'fam-other';
      const selected = !mine && !fam.groups.length;
      tabs.push(`<button type="button" role="tab" data-tab="${id}" aria-selected="${selected || (!mine && fam.others.some((x) => x.id === e.id))}">${fam.groups.length ? 'Other nouns & adjectives' : 'Nouns & adjectives'}</button>`);
      panels.push(`<div id="${id}" class="panel card" role="tabpanel">${fam.others.slice(0, 40).map((x) => `<div class="entry${x.id === e.id ? ' this' : ''}">
<div><div class="lemma">${link(x)}</div><div class="meta">${esc(POS_LABEL[x.pos] || x.pos)}${x.gender ? ` · ${x.gender}.` : ''}</div></div>
<div class="gloss">${esc(headline(x, 60))}</div></div>`).join('')}</div>`);
    }
    // When the word sits in "other", select that tab instead of the first verb.
    if (!mine && fam.others.some((x) => x.id === e.id)) {
      tabs.forEach((t, i) => { tabs[i] = t.replace('aria-selected="true"', 'aria-selected="false"'); });
      tabs[tabs.length - 1] = tabs[tabs.length - 1].replace('aria-selected="false"', 'aria-selected="true"');
    }
    familyPanel = `
<section id="family" class="panel" role="tabpanel" aria-labelledby="t-family">
<h2>Words from the root <span class="ar">${esc(e.root)}</span></h2>
<p class="sub">Arabic verbs come in forms; each form's nouns are listed under its verb. ${rootSlug ? `<a href="/root/${rootSlug}/">See the whole root on one page →</a>` : ''}</p>
<div class="fam-tabs" role="tablist" data-tab-group="fam">${tabs.join('')}</div>
${panels.join('')}
</section>`;
  }

  // --------------------------------------------------- forms/conjugation
  let formsPanel = '';
  let formsLabel = '';
  if (e.pos === 'verb' && e.conj) {
    formsLabel = 'Conjugation';
    const moods = MOODS.filter(([m]) => e.conj[m]);
    const rows = PRONOUNS.filter(([k]) => moods.some(([m]) => e.conj[m]?.[k])).map(([k, ar, en]) => `<tr><th><span class="ar">${ar}</span> <span>${esc(en)}</span></th>${moods.map(([m]) => `<td class="ar">${esc((e.conj[m]?.[k] || ['—']).join(' / '))}</td>`).join('')}</tr>`).join('');
    formsPanel = `
<section id="forms" class="panel" role="tabpanel" aria-labelledby="t-forms">
<h2>${esc(e.w)} conjugation</h2>
<p class="sub">Active voice. Present, subjunctive and jussive are the three moods of the non-past.</p>
<div class="scroll"><table class="conj"><thead><tr><th>Pronoun</th>${moods.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
<table class="conj"><tbody>
${e.masdar?.length ? `<tr><th>Verbal noun</th><td class="ar">${e.masdar.map(wordOrLink).join('، ')}</td></tr>` : ''}
${e.ap?.length ? `<tr><th>Active participle</th><td class="ar">${e.ap.map(wordOrLink).join('، ')}</td></tr>` : ''}
${e.pp?.length ? `<tr><th>Passive participle</th><td class="ar">${e.pp.map(wordOrLink).join('، ')}</td></tr>` : ''}
</tbody></table>
</section>`;
  } else if (e.pos !== 'verb') {
    const rows = [];
    const row = (k, words) => { if (words?.length) rows.push(`<tr><th>${esc(k)}</th><td class="ar">${words.map(wordOrLink).join('، ')}</td></tr>`); };
    row('Singular', [e.w]);
    if (e.pos === 'adj') {
      row('Feminine', e.fem); row('Masculine plural', e.mpl); row('Feminine plural', e.fpl);
      row('Plural', e.pl); row('Elative (more / most)', e.elative);
    } else {
      row('Plural', e.pl?.slice(0, 1)); row('Alternative plurals', e.pl?.slice(1));
      row('Feminine', e.fem); row('Singulative (one)', e.sing); row('Collective', e.coll);
    }
    if (rows.length > 1) {
      formsLabel = 'Forms';
      formsPanel = `
<section id="forms" class="panel" role="tabpanel" aria-labelledby="t-forms">
<h2>${esc(e.w)}: plural and other forms</h2>
<table class="conj"><tbody>${rows.join('')}</tbody></table>
</section>`;
    }
  }

  // ----------------------------------------------------------- examples
  const wikiEx = (e.senses || []).flatMap((s) => [
    ...(s.ex || []).map((x) => ({ ...x, sense: s.head })),
    ...(s.subs || []).flatMap((sub) => (sub.ex || []).map((x) => ({ ...x, sense: sub.g }))),
  ]);
  const corpus = ctx.corpusEx.get(e.id) || [];
  let examplesPanel = '';
  if (wikiEx.length || corpus.length) {
    const corpusHtml = corpus.map((x) => {
      const words = x.ar.split(/\s+/);
      const ar = words.map((w, i) => (i === x.hit ? `<b>${esc(w)}</b>` : esc(w))).join(' ');
      return `<div class="ex"><span class="ar" lang="ar">${ar}</span><span class="en">${esc(x.en)}</span><span class="ref">${esc(x.ref)}, Smith &amp; Van Dyke (1865) / KJV</span></div>`;
    }).join('');
    examplesPanel = `
<section id="examples" class="panel" role="tabpanel" aria-labelledby="t-examples">
<h2>${esc(e.w)} in a sentence</h2>
${wikiEx.length ? `<h3>Dictionary examples</h3>${wikiEx.map((x) => `<p class="sub">${esc(shortGloss(x.sense, 70))}</p>${exHtml(x)}`).join('')}` : ''}
${corpus.length ? `<h3>From a fully vowelled text</h3>${corpusHtml}` : ''}
</section>`;
  }

  const tabList = [
    ['dictionary', 'Dictionary'],
    familyPanel && ['family', 'Root family'],
    formsPanel && ['forms', formsLabel],
    examplesPanel && ['examples', 'Examples'],
  ].filter(Boolean);
  const tabs = `<nav class="tabs" role="tablist" data-tab-group="main">${tabList
    .map(([id, l], i) => `<a href="#${id}" id="t-${id}" role="tab" data-tab="${id}" aria-selected="${i === 0}">${esc(l)}</a>`).join('')}</nav>`;

  const body = `${header}${highlights}${tabs}${dictionaryPanel}${familyPanel}${formsPanel}${examplesPanel}
<div class="card" style="margin-top:2rem">
<p><strong>Learn ${esc(e.w)} for good.</strong> Add it to your ${BRAND} flashcards, drill its forms, and meet it again in real Arabic.</p>
<p><a class="cta" href="${APP_PATH}">Start learning free</a></p>
</div>`;

  // ------------------------------------------------------------ meta
  // ctx.titleGloss disambiguates two entries that would share a title.
  const g = ctx.titleGloss?.get(e.id) || headline(e, 40) || shortGloss(gloss, 40);
  const arabicFor = ctx.titlePos?.has(e.id) ? `Arabic ${pos.toLowerCase()} for` : 'Arabic for';
  const title = e.pos === 'verb'
    ? `${e.w} (${ascii}): ${arabicFor} "${g}" – meaning & conjugation | ${BRAND}`
    : `${e.w} (${ascii}): ${arabicFor} "${g}" – meaning, plural & root | ${BRAND}`;
  const glossList = (e.senses || []).slice(0, 3).map((s) => shortGloss(s.head, 40)).filter(Boolean);
  const bits = [
    `${e.w} (${e.rom || ascii}) is an Arabic ${pos.toLowerCase()} meaning ${glossList.length ? glossList.join('; ') : g}.`,
    e.pl?.length ? `Plural: ${e.pl.slice(0, 2).join(', ')}.` : '',
    e.pos === 'verb' && e.present?.[0] ? `Present: ${e.present[0]}.` : '',
    `Root ${e.root}, with examples and related words.`,
  ];
  let description = bits.filter(Boolean).join(' ');
  if (description.length > 300) description = `${description.slice(0, 297)}…`;

  const crumbs = [['Dictionary', '/words/']];
  if (rootSlug) crumbs.push([e.root, `/root/${rootSlug}/`]);
  crumbs.push([e.w, path]);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'DefinedTerm',
    name: e.w,
    alternateName: [e.rom, ascii].filter(Boolean),
    description: glossList.join('; ') || g,
    inLanguage: 'ar',
    url: `${SITE}${path}`,
    inDefinedTermSet: {
      '@type': 'DefinedTermSet',
      name: `Arabic words from the root ${e.root}`,
      ...(rootSlug ? { url: `${SITE}/root/${rootSlug}/` } : {}),
    },
  };

  const credits = [CREDIT_WIKTIONARY(e.page)];
  if (e.audio && e.audioFile) credits.push(CREDIT_AUDIO(e.audioFile));
  if (corpus.length) credits.push(CREDIT_BIBLE);
  credits.push(CREDIT_FREQUENCY);

  return { path, html: shell({ title, description, path, body, jsonLd, crumbs, credits, appPath: `/learn/dictionary/${slug}/` }) };
}
