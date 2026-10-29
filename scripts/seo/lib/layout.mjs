/** Page shell, styles and the small amount of client script the static pages use. */
import { esc } from './text.mjs';

export const SITE = process.env.SITE_URL || 'https://waznarabic.com';
export const BRAND = 'Wazn';
export const APP_PATH = '/'; // the study app lives at the root

// Mirrors src/lib/analytics.ts. Unset -> nothing is emitted.
const GA_ID = process.env.VITE_GA_MEASUREMENT_ID || '';
const GA_SNIPPET = GA_ID
  ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${GA_ID}');</script>`
  : '';

const CSS = `
:root{--bg:hsl(36 33% 97%);--card:hsl(36 40% 95%);--fg:hsl(24 10% 15%);
--muted:hsl(24 8% 42%);--primary:hsl(24 70% 45%);--primary-fg:hsl(36 33% 97%);--border:hsl(36 20% 88%);
--soft:hsl(24 70% 45% / .1);--well:hsl(36 20% 92%);
--shadow:0 2px 8px -2px hsl(24 20% 20% / .08),0 6px 20px -4px hsl(24 20% 20% / .06)}
@media(prefers-color-scheme:dark){:root{--bg:hsl(24 12% 10%);--card:hsl(24 10% 14%);
--fg:hsl(36 20% 92%);--muted:hsl(36 8% 64%);--primary:hsl(24 75% 58%);--primary-fg:hsl(24 15% 10%);
--border:hsl(24 10% 24%);--soft:hsl(24 75% 58% / .13);--well:hsl(24 8% 18%);
--shadow:0 2px 8px -2px hsl(0 0% 0% / .5),0 6px 20px -4px hsl(0 0% 0% / .4)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);
font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;line-height:1.6;
-webkit-font-smoothing:antialiased}
.ar{font-family:"Noto Naskh Arabic","Amiri","Traditional Arabic",serif;direction:rtl;unicode-bidi:isolate}
.wrap{max-width:52rem;margin:0 auto;padding:1.5rem 1rem 4rem}
header.site{position:sticky;top:0;z-index:10;border-bottom:1px solid var(--border);
background:color-mix(in srgb,var(--bg) 85%,transparent);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px)}
header.site .wrap{padding:.7rem 1rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:.5rem;text-decoration:none;color:var(--fg);font-weight:700;font-size:1.05rem}
.brand svg{width:26px;height:26px}
nav.site{margin-inline-start:auto;display:flex;gap:.25rem;font-size:.88rem;flex-wrap:wrap;align-items:center}
nav.site a{color:var(--muted);text-decoration:none;padding:.35rem .7rem;border-radius:999px;font-weight:500}
nav.site a:hover{color:var(--fg);background:var(--well)}
nav.site a.app{background:var(--primary);color:var(--primary-fg);font-weight:600}
nav.site a.app:hover{background:var(--primary);opacity:.9}
h1{font-size:1.75rem;line-height:1.25;margin:.2rem 0 .4rem;letter-spacing:-.01em}
h2{font-size:.78rem;margin:2.2rem 0 .7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
h3{font-size:1rem;margin:1.2rem 0 .4rem}
.crumbs{color:var(--muted);font-size:.82rem;margin:0 0 .9rem}
.crumbs a{color:var(--muted);text-decoration:none}
.crumbs a:hover{color:var(--fg)}
.rootline{font-size:2.6rem;font-weight:700;letter-spacing:.12em}
.sub{color:var(--muted);font-size:.92rem}
.card{background:var(--card);border:1px solid var(--border);border-radius:1rem;padding:.4rem 1.1rem;margin:.75rem 0}
.entry{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;
padding:.65rem .1rem;border-bottom:1px solid var(--border)}
.entry:last-child{border-bottom:0}
.entry .lemma{font-size:1.35rem;font-weight:600}
.entry .lemma a{text-decoration:none}
.entry .meta{font-size:.75rem;color:var(--muted);font-weight:500}
.entry .gloss{color:var(--muted);font-size:.9rem;text-align:right}
.verse{font-size:1.3rem;margin:.2rem 0 .4rem}
.cta{display:inline-flex;align-items:center;gap:.4rem;background:var(--primary);color:var(--primary-fg);text-decoration:none;
font-weight:600;font-size:.92rem;padding:.65rem 1.25rem;border-radius:999px;box-shadow:var(--shadow)}
.cta:hover{opacity:.92}
.cta.ghost{background:transparent;color:var(--primary);border:1px solid var(--primary);box-shadow:none}
.pill{display:inline-block;border:1px solid var(--border);background:var(--bg);border-radius:999px;
padding:.25rem .75rem;margin:.2rem .25rem .2rem 0;font-size:.8rem;text-decoration:none;color:var(--fg)}
a.pill:hover{border-color:var(--primary)}
a{color:var(--primary)}
footer.site{border-top:1px solid var(--border);margin-top:3rem;padding:1.25rem 0;font-size:.78rem;color:var(--muted)}
/* word pages */
.head{display:flex;flex-wrap:wrap;align-items:flex-start;gap:1rem 1.5rem;justify-content:space-between;
background:var(--card);border:1px solid var(--border);border-radius:1.5rem;padding:1.6rem 1.6rem 1.3rem;box-shadow:var(--shadow)}
.head h1{margin:0}
.hw{display:flex;align-items:center;gap:.75rem;margin:0}
.hw .ar{font-size:3.2rem;line-height:1.4;font-weight:700}
.tr{font-size:1.3rem;font-weight:600;color:var(--primary);margin:.1rem 0 .5rem}
.say{border:1px solid var(--border);background:var(--bg);color:var(--fg);border-radius:999px;
width:2.2rem;height:2.2rem;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.say:hover{color:var(--primary)}
.say svg{width:1.05rem;height:1.05rem}
.say.sm{width:1.7rem;height:1.7rem}.say.sm svg{width:.85rem;height:.85rem}
.tabs{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:.25rem;background:var(--well);
border-radius:1rem;padding:.25rem;margin:1.75rem 0 1rem;overflow-x:auto}
.tabs a{padding:.5rem .75rem;text-decoration:none;color:var(--muted);font-weight:500;font-size:.88rem;
border-radius:.75rem;white-space:nowrap;text-align:center}
.tabs a[aria-selected=true]{color:var(--fg);background:var(--card);box-shadow:0 1px 2px hsl(0 0% 0% / .08)}
.js .panel[hidden]{display:none}
.hl{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fill,minmax(10rem,1fr))}
.kf{background:var(--card);border:1px solid var(--border);border-radius:1rem;padding:.7rem 1rem}
.kf .k{font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
.kf .v{font-size:1.35rem}
.kf .g{font-size:.82rem;color:var(--muted)}
.kf a{text-decoration:none}
ol.senses{padding-inline-start:1.4rem;margin:.5rem 0}
ol.senses>li{margin:.75rem 0}
ol.subs{list-style:lower-alpha;padding-inline-start:1.3rem;margin:.3rem 0}
ol.subs>li{margin:.35rem 0}
.lbl{display:inline-block;background:var(--well);color:var(--muted);font-size:.72rem;font-weight:500;
border-radius:.375rem;padding:0 .4rem;margin-inline-end:.25rem}
.ex{margin:.45rem 0;padding:.6rem .9rem;background:var(--bg);border-radius:.75rem}
.ex .ar{font-size:1.2rem;display:block;line-height:1.9}
.ex .en{color:var(--muted);font-size:.9rem;display:block}
.ex .ref{color:var(--muted);font-size:.75rem;font-style:normal;opacity:.8}
.fam-tabs{display:flex;flex-wrap:wrap;gap:.35rem;margin:.4rem 0 .6rem}
.fam-tabs button{font:inherit;font-size:.82rem;border:1px solid var(--border);background:var(--card);
color:var(--fg);border-radius:999px;padding:.3rem .8rem;cursor:pointer}
.fam-tabs button[aria-selected=true]{background:var(--primary);border-color:var(--primary);color:var(--primary-fg)}
.verb-line{display:flex;justify-content:space-between;gap:1rem;align-items:baseline;flex-wrap:wrap}
.verb-line .lemma{font-size:1.5rem;font-weight:700}
.conn{margin:.6rem 0 0;padding:.4rem 0 0;border-top:1px dashed var(--border)}
.conn .entry .lemma{font-size:1.15rem}
.this{background:var(--soft);border-radius:.5rem}
table.conj{border-collapse:collapse;width:100%;font-size:.92rem;margin:.3rem 0 1rem;background:var(--card);
border:1px solid var(--border);border-radius:1rem;overflow:hidden}
table.conj th,table.conj td{border-bottom:1px solid var(--border);padding:.45rem .75rem;text-align:start}
table.conj th{color:var(--muted);font-weight:600;font-size:.78rem}
table.conj td.ar{font-size:1.2rem}
.scroll{overflow-x:auto}
.letters{display:flex;flex-wrap:wrap;gap:.4rem}
.letters a,.letters span{font-size:1.35rem;min-width:2.7rem;text-align:center}
#q{width:100%;font:inherit;font-size:1rem;padding:.9rem 1.1rem;border-radius:1rem;box-shadow:var(--shadow);
border:1px solid var(--border);background:var(--card);color:var(--fg)}
#q:focus{outline:none;box-shadow:0 0 0 3px var(--soft)}
#results{margin-top:.5rem}
#results:empty{display:none}
/* One line of header on a phone: the verb-form index is a tap away from any
   word page, so it is the link that gives way. */
@media(max-width:480px){header.site .wrap{flex-wrap:nowrap;gap:.4rem}
nav.site{flex-wrap:nowrap;gap:0;font-size:.82rem}nav.site a{padding:.3rem .55rem}
nav.site a.forms{display:none}.brand{font-size:1rem}.brand svg{width:22px;height:22px}}
`.trim();

const LOGO_SVG = `<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 5v20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M6 10h20" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M16 27h-6M16 27h6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M3 10l3.5 7a4 4 0 0 0 7 0L17 10" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".55"/><path d="M15 10l3.5 7a4 4 0 0 0 7 0L29 10" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" opacity=".55"/></svg>`;

const SPEAKER_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>`;

/** A pronunciation button: a real recording when we have one, else the browser's Arabic voice. */
export function speakButton(text, { audio = '', small = false } = {}) {
  return `<button type="button" class="say${small ? ' sm' : ''}" data-say="${esc(text)}"${audio ? ` data-audio="${esc(audio)}"` : ''} aria-label="Listen to ${esc(text)}" title="Listen">${SPEAKER_SVG}</button>`;
}

// Tabs, root-family sub-tabs and pronunciation. Without JavaScript every
// panel simply shows, stacked, so nothing is ever hidden from crawlers.
const CLIENT_JS = `
(function(){var d=document;d.documentElement.classList.add('js');
function show(group,id){var tabs=d.querySelectorAll('[data-tab-group="'+group+'"] [data-tab]');
for(var i=0;i<tabs.length;i++){var t=tabs[i],on=t.getAttribute('data-tab')===id;t.setAttribute('aria-selected',on);
var p=d.getElementById(t.getAttribute('data-tab'));if(p)p.hidden=!on;}}
var groups=d.querySelectorAll('[data-tab-group]');
for(var g=0;g<groups.length;g++)(function(el){var name=el.getAttribute('data-tab-group');
var first=el.querySelector('[data-tab][aria-selected=true]')||el.querySelector('[data-tab]');
if(name==='main'&&location.hash){var h=el.querySelector('[data-tab="'+location.hash.slice(1)+'"]');if(h)first=h;}
if(first)show(name,first.getAttribute('data-tab'));
el.addEventListener('click',function(e){var t=e.target.closest('[data-tab]');if(!t)return;e.preventDefault();
show(name,t.getAttribute('data-tab'));if(name==='main')history.replaceState(null,'','#'+t.getAttribute('data-tab'));});})(groups[g]);
d.addEventListener('click',function(e){var a=e.target.closest('a[data-goto]');if(!a)return;var m=d.querySelector('[data-tab-group=main]');
if(m){e.preventDefault();show('main',a.getAttribute('data-goto'));m.scrollIntoView({behavior:'smooth'});}});
var synth=window.speechSynthesis;
d.addEventListener('click',function(e){var b=e.target.closest('.say');if(!b)return;
var src=b.getAttribute('data-audio');if(src){new Audio(src).play().catch(function(){});return;}
if(!synth)return;synth.cancel();var u=new SpeechSynthesisUtterance(b.getAttribute('data-say'));u.lang='ar';
var v=synth.getVoices().filter(function(v){return/^ar/i.test(v.lang)})[0];if(v)u.voice=v;synth.speak(u);});
if(!synth){var bs=d.querySelectorAll('.say:not([data-audio])');for(var j=0;j<bs.length;j++)bs[j].hidden=true;}
var signedIn=false;try{for(var k=0;k<localStorage.length;k++)if(/^sb-.*-auth-token$/.test(localStorage.key(k)||'')){signedIn=true;break;}}catch(e){}
if(signedIn){var ap=d.querySelectorAll('nav.site a.app');for(var n=0;n<ap.length;n++){ap[n].href=ap[n].getAttribute('data-app');ap[n].textContent='Open in Wazn';}}
})();`.trim();

/**
 * @param {object} o
 * @param {Array<[string,string]>} [o.crumbs] [name, path] pairs, last = this page
 * @param {string[]} [o.credits] extra attribution lines for the footer
 */
export function shell({ title, description, path, body, jsonLd = [], crumbs = [], credits = [], noindex = false, appPath = '' }) {
  const canonical = `${SITE}${path}`;
  const ld = [...(Array.isArray(jsonLd) ? jsonLd : [jsonLd])].filter(Boolean);
  if (crumbs.length > 1) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map(([name, p], i) => ({
        '@type': 'ListItem', position: i + 1, name, item: `${SITE}${p}`,
      })),
    });
  }
  const crumbHtml = crumbs.length > 1
    ? `<p class="crumbs">${crumbs.map(([name, p], i) => (i === crumbs.length - 1
      ? `<bdi>${esc(name)}</bdi>` : `<a href="${esc(p)}"><bdi>${esc(name)}</bdi></a>`)).join(' › ')}</p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canonical)}">`}
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:site_name" content="${BRAND}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#C2622A">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n')}
${GA_SNIPPET}
</head>
<body>
<header class="site"><div class="wrap">
<a class="brand" href="/"><span style="color:var(--primary)">${LOGO_SVG}</span>${BRAND}</a>
<nav class="site">
<a href="/words/">Dictionary</a><a href="/roots/">Roots</a><a class="forms" href="/forms/">Verb forms</a><a class="app" href="${APP_PATH}" data-app="${esc(appPath || '/learn/dictionary/')}">Open the app</a>
</nav>
</div></header>
<main class="wrap">
${crumbHtml}
${body}
</main>
<footer class="site"><div class="wrap">
<p>${BRAND}: learn Arabic through its roots and patterns.</p>
${credits.map((c) => `<p>${c}</p>`).join('\n')}
</div></footer>
<script>${CLIENT_JS}</script>
</body>
</html>`;
}

export const CREDIT_WIKTIONARY = (page) => `Definitions, forms and Wiktionary examples are adapted from
${page ? `the <a href="https://en.wiktionary.org/wiki/${encodeURIComponent(page)}#Arabic" rel="nofollow">Wiktionary entry for ${esc(page)}</a>` : '<a href="https://en.wiktionary.org/" rel="nofollow">Wiktionary</a>'}
by its contributors, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license">CC BY-SA 4.0</a>.
This page is available under the same license.`;

export const CREDIT_BIBLE = `Corpus sentences are from the Smith &amp; Van Dyke Arabic Bible (1865, public domain),
tagged with data from <a href="https://stepbible.org" rel="nofollow">STEPBible</a> (CC BY-SA 4.0); English from the King James Version
(public domain). Texts are presented as language corpora for study.`;

export const CREDIT_FREQUENCY = `Word frequency ranking from
<a href="https://github.com/hermitdave/FrequencyWords" rel="nofollow">FrequencyWords</a> (OpenSubtitles 2018, CC BY-SA 4.0).`;

export const CREDIT_AUDIO = (file) => `Pronunciation recording from
<a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}" rel="nofollow">Wikimedia Commons</a>
(see the file page for its author and license).`;
