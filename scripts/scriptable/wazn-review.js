// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: language;

/**
 * Wazn — home-screen review for Scriptable (iOS)
 * ---------------------------------------------------------------------------
 * Two modes in one file:
 *
 *   WIDGET   Shows how many cards are due and the next word's Arabic. Tapping
 *            it launches the review session below.
 *
 *   IN APP   A full-screen review session. Tap the middle to flip; once the
 *            answer is showing, tap the LEFT third for "Again" and the RIGHT
 *            third for "Easy". Each word is read aloud, and the answer side
 *            carries the same detail the web app shows: root, form, the word's
 *            other forms, its family, and the other words you know that share
 *            its root or its pattern.
 *
 * Why the reviewing does not happen inside the widget: iOS only lets a
 * Scriptable widget respond to a tap by opening a URL. It cannot re-render in
 * place, so a card cannot flip on the home screen. (iOS 17 added interactive
 * widgets, but Scriptable does not expose that API.) One tap from the home
 * screen into a real session is as close as the platform allows.
 *
 * Scheduling mirrors src/lib/spaced-repetition.ts exactly, so grades made here
 * and grades made in the web app stay consistent with each other.
 *
 * SETUP
 *   1. Scriptable → + → paste this file → name it "Wazn Review".
 *   2. Run it once. It asks for your Wazn email and password and stores them
 *      in the iOS Keychain (not in this file, and never written to disk).
 *   3. Home screen → add a Scriptable widget → choose this script.
 *      Set "When Interacting" to "Run Script".
 */

// ---------------------------------------------------------------- config

const SUPABASE_URL = "https://fphpcfecgnfoogfaeihu.supabase.co";
// Publishable anon key — the same value the web app ships to browsers. It is
// not a secret; row-level security is what actually protects the data.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaHBjZmVjZ25mb29nZmFlaWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzY2NjAsImV4cCI6MjA5OTk1MjY2MH0.2OXlbp8EuQpgv0Mnk5Ps3XbL16-vI8vDDRTWi4yYOk4";

// Pre-fills the email box on first run so only the password has to be typed.
// Note this repository is public, so this address is visible in the file and in
// git history. The password is deliberately NOT here — the Keychain holds it
// after the first run, and a credential in a script is one screenshot away from
// being shared.
const DEFAULT_EMAIL = "rbm66@byu.edu";

// The live site, opened by the logo button at the top of the review screen.
// Update this when the custom domain is pointed at the app.
const SITE_URL = "https://iamrichardmaier-sudo.github.io/benarabic/";

const KEY_EMAIL = "wazn.email";
const KEY_PASSWORD = "wazn.password";
const CACHE_FILE = "wazn-widget-cache.json";

const BRAND = "#C2622A";
const CREAM = "#FDF8F2";
const INK = "#2B2118";

// ------------------------------------------------------------- scheduling

const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const MIN_INTERVAL = 1;

/** Mirrors reviewCard() in the web app. Keep the two in step. */
function schedule(card, rating) {
  let interval = card.interval_days;
  let ease = card.ease_factor;

  if (rating === "again") {
    interval = 1;
    ease -= 0.2;
  } else if (rating === "hard") {
    interval = Math.max(MIN_INTERVAL, Math.round(interval * 1.2));
    ease -= 0.15;
  } else if (rating === "good") {
    interval = Math.max(MIN_INTERVAL, Math.round(interval * ease));
  } else if (rating === "easy") {
    interval = Math.max(MIN_INTERVAL, Math.round(interval * ease * 1.3));
    ease += 0.1;
  }

  ease = Math.max(MIN_EASE, Math.min(MAX_EASE, ease));

  const next = new Date();
  next.setDate(next.getDate() + interval);

  return {
    interval_days: interval,
    ease_factor: ease,
    next_review_date: isoDay(next),
  };
}

/** Local calendar day as yyyy-mm-dd. Using UTC would roll the day over early
 *  for anyone studying at night west of Greenwich. */
function isoDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ------------------------------------------------------------------ auth

async function credentials(promptIfMissing) {
  if (Keychain.contains(KEY_EMAIL) && Keychain.contains(KEY_PASSWORD)) {
    return { email: Keychain.get(KEY_EMAIL), password: Keychain.get(KEY_PASSWORD) };
  }
  // A widget refresh cannot show a prompt, so it just reports "not signed in".
  if (!promptIfMissing) return null;

  const a = new Alert();
  a.title = "Sign in to Wazn";
  a.message = "Stored in the iOS Keychain on this device only.";
  a.addTextField("Email", DEFAULT_EMAIL);
  a.addSecureTextField("Password");
  a.addAction("Sign in");
  a.addCancelAction("Cancel");
  const choice = await a.presentAlert();
  if (choice === -1) return null;

  const email = a.textFieldValue(0).trim();
  const password = a.textFieldValue(1);
  if (!email || !password) return null;

  Keychain.set(KEY_EMAIL, email);
  Keychain.set(KEY_PASSWORD, password);
  return { email, password };
}

function forgetCredentials() {
  if (Keychain.contains(KEY_EMAIL)) Keychain.remove(KEY_EMAIL);
  if (Keychain.contains(KEY_PASSWORD)) Keychain.remove(KEY_PASSWORD);
}

async function signIn(promptIfMissing) {
  const creds = await credentials(promptIfMissing);
  if (!creds) return null;

  const req = new Request(`${SUPABASE_URL}/auth/v1/token?grant_type=password`);
  req.method = "POST";
  req.headers = { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" };
  req.body = JSON.stringify({ email: creds.email, password: creds.password });

  const res = await req.loadJSON();
  if (!res || !res.access_token) {
    // Wrong password, or the account changed — clear it so the next run asks
    // again rather than failing identically forever.
    if (promptIfMissing) forgetCredentials();
    return null;
  }
  return res.access_token;
}

// ------------------------------------------------------------------ data

function restHeaders(token) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// Everything the answer side of a card shows. The page reads these field names
// straight off the row, so this list and the markup have to stay in step.
const CARD_COLUMNS = [
  "id", "word", "word_voweled", "english", "image_url",
  "root", "word_type", "verb_form",
  "fusha_plural", "shaami", "shaami_plural",
  "past_tense", "present_tense", "masdar_form", "companion_forms",
  "interval_days", "ease_factor", "next_review_date",
].join(",");

// Deliberately shorter than CARD_COLUMNS: this one pulls every card in the
// deck rather than just the due ones, and is only used to list words that
// share a root or a pattern.
const DECK_COLUMNS = [
  "id", "word", "word_voweled", "english", "root", "verb_form",
].join(",");

// See-also lists, not concordances — the same instinct as the web app's
// popover, which stops at a handful however many matches exist.
const MAX_RELATED = 6;
const MAX_CORPUS = 5;

async function fetchDueCards(token) {
  const url =
    `${SUPABASE_URL}/rest/v1/flashcards` +
    `?select=${CARD_COLUMNS}` +
    `&learning_stage=eq.graduated` +
    `&next_review_date=lte.${isoDay()}` +
    `&order=next_review_date.asc`;

  const req = new Request(url);
  req.headers = restHeaders(token);
  const rows = await req.loadJSON();
  return Array.isArray(rows) ? rows : [];
}

/** Every card in the deck, due or not — the pool the "also in your deck" and
 *  "other Form N words" lists are drawn from. */
async function fetchDeck(token) {
  const req = new Request(`${SUPABASE_URL}/rest/v1/flashcards?select=${DECK_COLUMNS}`);
  req.headers = restHeaders(token);
  const rows = await req.loadJSON();
  return Array.isArray(rows) ? rows : [];
}

/** Tagged Bible words sharing any of the given roots.
 *
 *  Fetched for the whole session up front rather than per card: once the
 *  review page is on screen it cannot make network calls of its own, so
 *  everything it will ever show has to be in hand before it opens. Roots go
 *  out in batches so the query string stays well short of any URL limit. */
async function fetchCorpusByRoots(token, roots) {
  const rows = [];
  for (let i = 0; i < roots.length; i += 50) {
    const batch = roots.slice(i, i + 50).map(encodeURIComponent).join(",");
    const url =
      `${SUPABASE_URL}/rest/v1/bible_word_tags` +
      `?select=surface,lemma,root,verb_form,gloss` +
      `&tagged_at=not.is.null` +
      `&root=in.(${batch})` +
      `&limit=600`;
    const req = new Request(url);
    req.headers = restHeaders(token);
    const page = await req.loadJSON();
    if (Array.isArray(page)) rows.push(...page);
  }
  return rows;
}

// --------------------------------------------------------- cross-references

/** The bare consonants of a word, for comparison only.
 *
 *  Cards sometimes hold two spellings in one field ("طول / طِوال") and the
 *  same word appears vowelled in one place and bare in another, so comparing
 *  the stored strings would let a word turn up in its own see-also list. */
function baseWord(s) {
  return String(s || "")
    .split("/")[0]
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .trim();
}

function push(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** Attaches the see-also lists to each due card, ahead of the page being
 *  built. One `seen` set spans all three lists per card, so a word that is
 *  both in the deck and in the Bible corpus is listed once, under the first
 *  heading that claims it. */
function attachRelated(cards, deck, corpus) {
  const deckByRoot = new Map();
  const deckByForm = new Map();
  for (const d of deck) {
    if (d.root) push(deckByRoot, d.root, d);
    if (d.verb_form) push(deckByForm, d.verb_form, d);
  }

  const corpusByRoot = new Map();
  for (const w of corpus) {
    if (w.root) push(corpusByRoot, w.root, w);
  }

  for (const c of cards) {
    const seen = new Set([baseWord(c.word), baseWord(c.word_voweled)]);
    for (const f of c.companion_forms || []) seen.add(baseWord(f && f.form));

    const take = (rows, cap, toEntry) => {
      const out = [];
      for (const row of rows || []) {
        const entry = toEntry(row);
        const key = baseWord(entry.ar);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(entry);
        if (out.length >= cap) break;
      }
      return out;
    };

    const fromDeck = (d) => ({ ar: d.word_voweled || d.word, en: d.english || "" });

    c.same_root = take(deckByRoot.get(c.root), MAX_RELATED, fromDeck);
    c.corpus_root = take(corpusByRoot.get(c.root), MAX_CORPUS, (w) => ({
      ar: w.lemma || w.surface,
      en: w.gloss || "",
    }));
    c.same_form = take(deckByForm.get(c.verb_form), MAX_RELATED, fromDeck);
  }
}

async function saveGrade(token, id, fields) {
  const req = new Request(`${SUPABASE_URL}/rest/v1/flashcards?id=eq.${id}`);
  req.method = "PATCH";
  req.headers = { ...restHeaders(token), Prefer: "return=minimal" };
  req.body = JSON.stringify(fields);
  await req.load();
}

// ----------------------------------------------------------------- cache

function cachePath() {
  const fm = FileManager.local();
  return fm.joinPath(fm.cacheDirectory(), CACHE_FILE);
}

function readCache() {
  try {
    const fm = FileManager.local();
    const p = cachePath();
    if (!fm.fileExists(p)) return null;
    return JSON.parse(fm.readString(p));
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    FileManager.local().writeString(cachePath(), JSON.stringify(data));
  } catch {
    /* a stale widget is not worth failing the run over */
  }
}

// ---------------------------------------------------------------- widget

function buildWidget(state) {
  const w = new ListWidget();
  w.backgroundColor = new Color(CREAM);
  w.setPadding(14, 14, 14, 14);

  const header = w.addStack();
  header.centerAlignContent();
  const title = header.addText("WAZN");
  title.font = Font.boldSystemFont(11);
  title.textColor = new Color(BRAND);
  header.addSpacer();

  if (state.due > 0) {
    const badge = header.addText(String(state.due));
    badge.font = Font.boldSystemFont(13);
    badge.textColor = new Color(BRAND);
  }

  w.addSpacer(6);

  if (state.error) {
    const t = w.addText(state.error);
    t.font = Font.systemFont(12);
    t.textColor = new Color(INK);
    t.minimumScaleFactor = 0.7;
  } else if (state.due === 0) {
    const t = w.addText("All caught up");
    t.font = Font.semiboldSystemFont(15);
    t.textColor = new Color(INK);
    w.addSpacer(2);
    const s = w.addText("Nothing due right now.");
    s.font = Font.systemFont(11);
    s.textColor = new Color(INK);
    s.textOpacity = 0.6;
  } else {
    const word = w.addText(state.word || "");
    word.font = Font.boldSystemFont(30);
    word.textColor = new Color(INK);
    word.centerAlignText();
    word.minimumScaleFactor = 0.5;
    word.lineLimit = 2;

    w.addSpacer(4);
    const hint = w.addText(
      `${state.due} card${state.due === 1 ? "" : "s"} due · tap to review`,
    );
    hint.font = Font.systemFont(10);
    hint.textColor = new Color(INK);
    hint.textOpacity = 0.6;
    hint.centerAlignText();
  }

  w.addSpacer();
  // Tapping anywhere runs this same script, which then falls into review mode.
  w.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}`;
  return w;
}

// -------------------------------------------------------- review session

function reviewHTML(cards) {
  // Cards are injected as JSON rather than templated into markup, so a word
  // containing a quote or an angle bracket cannot break the page.
  const payload = JSON.stringify(cards).replace(/</g, "\\u003c");

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<style>
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  html, body { margin:0; height:100%; overflow:hidden;
    background:${CREAM}; color:${INK};
    font-family:-apple-system,system-ui,sans-serif; user-select:none; }
  #app { height:100%; display:flex; flex-direction:column; }
  header { display:flex; align-items:center; gap:10px; padding:12px 16px 2px; }
  #quitline { text-align:center; padding-bottom:4px; }
  #bar { flex:1; height:5px; border-radius:3px; background:rgba(0,0,0,.09); overflow:hidden; }
  #fill { height:100%; width:0%; background:${BRAND}; transition:width .25s ease; }
  #count { font-size:12px; opacity:.55; font-variant-numeric:tabular-nums; }
  #quit { font-size:11px; opacity:.45; }
  #logo { display:flex; align-items:center; gap:6px; padding:4px 8px 4px 2px;
          font-size:13px; font-weight:800; letter-spacing:.06em; color:${BRAND}; }
  #logo svg { width:19px; height:19px; }
  main { flex:1; position:relative; display:flex; min-height:0; }
  /* margin:auto on the card centres it while it is short but still lets it
     scroll once the answer side is taller than the screen — which
     justify-content:center would not, as it clips the top away. */
  #scroll { flex:1; display:flex; overflow-y:auto; -webkit-overflow-scrolling:touch;
            padding:14px 20px 16px; }
  #card { margin:auto; width:100%; text-align:center; }
  .ar { font-size:56px; font-weight:700; direction:rtl; line-height:1.35; }
  .ar.sm { font-size:44px; }
  .en { font-size:24px; opacity:.75; margin-top:12px; line-height:1.3; }
  .meta { font-size:13px; color:${BRAND}; margin-top:9px; font-weight:600; }
  .meta .rt { direction:rtl; font-size:15px; }
  .speak { display:inline-flex; align-items:center; justify-content:center;
           width:38px; height:38px; margin-top:12px; border-radius:50%;
           background:rgba(194,98,42,.13); color:${BRAND}; }
  .speak svg { width:20px; height:20px; }
  .detail { margin-top:16px; text-align:start; }
  .sect { border-top:1px solid rgba(0,0,0,.09); margin-top:13px; padding-top:10px; }
  .sect h3 { margin:0 0 6px; font-size:10.5px; font-weight:700; opacity:.45;
             letter-spacing:.09em; text-transform:uppercase; }
  .row { display:flex; align-items:baseline; justify-content:space-between;
         gap:14px; padding:3px 0; }
  .row .lbl { font-size:12.5px; opacity:.6; line-height:1.35; }
  .row .val { font-size:19px; direction:rtl; white-space:nowrap; flex:none; }
  img { max-width:78%; max-height:26vh; border-radius:14px; margin-top:16px; }
  /* A row of its own rather than an overlay: the answer side scrolls now, and
     a floating hint would sit on top of whatever happened to scroll under it. */
  #tip { flex:none; text-align:center; font-size:12px; opacity:.45;
         padding:0 16px 8px; }
  #flash { position:absolute; inset:0; display:flex; align-items:center;
           justify-content:center; font-size:34px; font-weight:800;
           color:#fff; opacity:0; pointer-events:none; transition:opacity .18s; }
  footer { display:flex; gap:10px; padding:0 16px 26px; }
  .btn { flex:1; padding:15px 0; border-radius:15px; font-size:16px;
         font-weight:700; color:#fff; text-align:center; }
  .again { background:#C0392B; }
  .easy  { background:#2E7D52; }
  #done { display:none; flex-direction:column; align-items:center;
          justify-content:center; height:100%; gap:14px; }
  #done h2 { font-size:26px; margin:0; }
  #done p { opacity:.6; margin:0; font-size:15px; }
  #done .btn { background:${BRAND}; padding:14px 34px; flex:none; }
</style></head>
<body>
<div id="app">
  <header>
    <span id="logo" data-nav="site" title="Open Wazn">
      <svg viewBox="0 0 40 40" fill="none" stroke="currentColor"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="20" cy="6.5" r="2.1" fill="currentColor" stroke="none"/>
        <path d="M20 8.5v22" stroke-width="2.4"/>
        <path d="M7 13h26" stroke-width="2.4"/>
        <path d="M13.5 31h13" stroke-width="2.4"/>
        <path d="M3 13.4l3.4 6.8a4.2 4.2 0 0 0 7.2 0L17 13.4" stroke-width="1.9"/>
        <path d="M23 13.4l3.4 6.8a4.2 4.2 0 0 0 7.2 0L37 13.4" stroke-width="1.9"/>
      </svg>WAZN
    </span>
    <div id="bar"><div id="fill"></div></div>
    <span id="count"></span>
  </header>
  <div id="quitline"><span id="quit">Swipe down when you\u2019re done</span></div>
  <main>
    <div id="scroll"><div id="card"></div></div>
    <div id="flash"></div>
  </main>
  <div id="tip">Tap to flip</div>
  <footer>
    <div class="btn again" data-act="again">Again</div>
    <div class="btn easy"  data-act="easy">Easy</div>
  </footer>
</div>

<div id="done">
  <h2>Done</h2>
  <p id="doneText"></p>
  <p style="opacity:.5;font-size:14px">Swipe down to save and close.</p>
</div>

<script>
const CARDS = ${payload};
const results = [];
let i = 0, flipped = false;

const $ = (s) => document.querySelector(s);

function render() {
  const c = CARDS[i];
  if (!c) return finishScreen();
  flipped = false;
  $('#tip').textContent = 'Tap to flip';
  $('#count').textContent = (i + 1) + '/' + CARDS.length;
  $('#fill').style.width = ((i / CARDS.length) * 100) + '%';
  $('#card').innerHTML = '<div class="ar">' + esc(c.word) + '</div>' + speaker();
  $('#scroll').scrollTop = 0;
  $('footer').style.visibility = 'hidden';
  say(spoken(c));
}

function flip() {
  const c = CARDS[i];
  if (!c) return;
  flipped = !flipped;
  if (!flipped) return render();
  let html = '<div class="ar sm">' + esc(c.word_voweled || c.word) + '</div>' + speaker();
  if (c.english) html += '<div class="en">' + esc(c.english) + '</div>';
  html += detail(c);
  if (c.image_url) html += '<img src="' + esc(c.image_url) + '">';
  $('#card').innerHTML = html;
  $('#scroll').scrollTop = 0;
  $('#tip').textContent = 'Left = Again   ·   Right = Easy';
  $('footer').style.visibility = 'visible';
  say(spoken(c));
}

/* ------------------------------------------------------------- word detail */

function row(label, value) {
  return '<div class="row"><span class="lbl">' + label +
         '</span><span class="val" dir="rtl">' + value + '</span></div>';
}

function section(title, rows) {
  if (!rows) return '';
  return '<div class="sect"><h3>' + title + '</h3>' + rows + '</div>';
}

function listRows(items) {
  return (items || []).map((w) => row(esc(w.en), esc(w.ar))).join('');
}

/** Everything the web app shows about a word, in the order it shows it: what
 *  the word is, then its own other forms, then the words standing around it. */
function detail(c) {
  let html = '';

  const bits = [];
  if (c.root) bits.push('<span class="rt" dir="rtl">' + esc(c.root) + '</span>');
  if (c.verb_form) bits.push('Form ' + esc(c.verb_form));
  if (c.word_type && c.word_type !== 'other') {
    bits.push(esc(c.word_type.charAt(0).toUpperCase() + c.word_type.slice(1)));
  }
  if (bits.length) html += '<div class="meta">' + bits.join(' · ') + '</div>';

  const forms = [
    ['Plural', c.fusha_plural],
    ['Shaami', c.shaami],
    ['Shaami pl.', c.shaami_plural],
    ['Past', c.past_tense],
    ['Present', c.present_tense],
    ['Masdar', c.masdar_form],
  ].filter((f) => f[1]).map((f) => row(f[0], esc(f[1]))).join('');

  let d = section('Its other forms', forms);

  d += section('Word family', (c.companion_forms || [])
    .map((f) => row(esc(f.label), esc(f.form))).join(''));

  d += section('Same root in your deck', listRows(c.same_root));
  d += section('Same root in the Bible', listRows(c.corpus_root));
  d += section(
    'Other Form ' + esc(c.verb_form) + ' words you know',
    c.verb_form ? listRows(c.same_form) : ''
  );

  return html + (d ? '<div class="detail">' + d + '</div>' : '');
}

/* ------------------------------------------------------------------ speech */

/** The vowelled spelling reads far better than the bare one, and a card that
 *  holds two spellings should be read as the first, not as both. */
function spoken(c) {
  return String(c.word_voweled || c.word || '').split('/')[0].trim();
}

let arVoice = null;
function pickVoice() {
  if (arVoice || !window.speechSynthesis || !speechSynthesis.getVoices) return arVoice;
  const vs = speechSynthesis.getVoices() || [];
  arVoice = vs.filter((v) => v.lang === 'ar-SA')[0] ||
            vs.filter((v) => String(v.lang || '').indexOf('ar') === 0)[0] || null;
  return arVoice;
}

if (window.speechSynthesis) {
  pickVoice();
  // The voice list is filled in asynchronously and is usually empty on the
  // first call, so take a second look once the device has populated it.
  speechSynthesis.onvoiceschanged = pickVoice;
}

/** Mirrors speakArabic() in the web app: the ar-SA voice where the device has
 *  one, and a slower rate, because vowelled Arabic at full speed is hard to
 *  catch. If this WebView has no speech synthesis at all, Scriptable's own
 *  Speech API is asked to read the word instead. */
function say(text) {
  const t = String(text || '');
  if (!t) return;
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    ping('speak?text=' + encodeURIComponent(t));
    return;
  }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'ar-SA';
    u.rate = 0.8;
    const v = pickVoice();
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (err) {
    ping('speak?text=' + encodeURIComponent(t));
  }
}

function speaker() {
  return '<div><span class="speak" data-act="speak" title="Listen">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M11 5 6 9H2v6h4l5 4z"/>' +
    '<path d="M15.6 8.6a5 5 0 0 1 0 6.8"/>' +
    '<path d="M19 5.2a9 9 0 0 1 0 13.6"/>' +
    '</svg></span></div>';
}

function grade(rating) {
  if (!flipped || !CARDS[i]) return;
  const id = CARDS[i].id;
  results.push({ id: id, rating: rating });
  // Hand the grade to Scriptable straight away so it reaches the database
  // while the session is still open, rather than only on the way out.
  ping('grade?id=' + encodeURIComponent(id) + '&rating=' + rating);
  flash(rating === 'easy' ? 'Easy' : 'Again', rating === 'easy' ? '#2E7D52' : '#C0392B');
  i++;
  setTimeout(render, 170);
}

/** Fires a wazn:// request that the native side intercepts and blocks. Sent
 *  from a hidden iframe so the page itself never attempts to navigate. */
function ping(path) {
  const f = document.createElement('iframe');
  f.style.display = 'none';
  f.src = 'wazn://' + path;
  document.body.appendChild(f);
  setTimeout(function () { f.remove(); }, 80);
}

function flash(text, color) {
  const f = $('#flash');
  f.textContent = text;
  f.style.background = color;
  f.style.opacity = '.92';
  setTimeout(() => { f.style.opacity = '0'; }, 160);
}

function finishScreen() {
  $('#app').style.display = 'none';
  $('#done').style.display = 'flex';
  $('#doneText').textContent =
    results.length + ' card' + (results.length === 1 ? '' : 's') + ' reviewed.';
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (ch) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[ch]
  ));
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-nav="site"]')) { ping('open-site'); return; }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;
  if (a === 'speak') { const c = CARDS[i]; if (c) say(spoken(c)); return; }
  if (a === 'flip') { flip(); return; }
  if (!flipped) { flip(); return; }   // the footer buttons only grade after the reveal
  grade(a);
});

/* The thirds used to be an overlay sitting on top of the card. Now that the
   answer side carries the full word detail it has to be able to scroll, and an
   overlay swallows the scroll gesture — so the third is worked out from where
   the tap landed instead, and the card scrolls normally underneath. */
const scroll = $('#scroll');
let dragged = false;

scroll.addEventListener('touchstart', () => { dragged = false; }, { passive: true });
scroll.addEventListener('touchmove', () => { dragged = true; }, { passive: true });

scroll.addEventListener('click', (e) => {
  // A tap that ended a scroll is not a grade.
  if (dragged) { dragged = false; return; }
  // The speaker button and anything else with its own job is handled above.
  if (e.target.closest('[data-act],[data-nav]')) return;
  if (!flipped) { flip(); return; }

  const x = e.clientX / scroll.clientWidth;
  if (x < 0.32) grade('again');
  else if (x > 0.68) grade('easy');
  else flip();
});

render();
</script>
</body></html>`;
}

async function runReview() {
  const token = await signIn(true);
  if (!token) {
    const a = new Alert();
    a.title = "Could not sign in";
    a.message = "Check your email and password, then run the script again.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  let cards;
  try {
    cards = await fetchDueCards(token);
  } catch (e) {
    const a = new Alert();
    a.title = "Could not load cards";
    a.message = String(e);
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  writeCache({
    due: cards.length,
    word: cards.length ? cards[0].word : "",
    at: Date.now(),
  });

  if (cards.length === 0) {
    const a = new Alert();
    a.title = "All caught up";
    a.message = "Nothing is due right now. Come back tomorrow.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  // The see-also lists are assembled before the session opens, because the
  // page cannot fetch anything once it is on screen. Failing here costs the
  // cross-references and nothing else, so it must not stop the review.
  try {
    const roots = [...new Set(cards.map((c) => c.root).filter(Boolean))];
    const [deck, corpus] = await Promise.all([
      fetchDeck(token),
      fetchCorpusByRoots(token, roots),
    ]);
    attachRelated(cards, deck, corpus);
  } catch (e) {
    /* review without the cross-references rather than not at all */
  }

  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  const savedIds = new Set();

  const wv = new WebView();
  await wv.loadHTML(reviewHTML(cards));

  // The page cannot call back into Scriptable mid-session, so it navigates to
  // a wazn:// URL instead and this handler intercepts it. Returning false
  // blocks the navigation, leaving the session on screen untouched.
  //
  // Saves here are deliberately not awaited: this callback must return a
  // boolean synchronously, and blocking the UI on a network round-trip after
  // every card would make grading feel sticky. Anything that fails is caught
  // by the reconciling pass after dismissal, which re-sends whatever is still
  // missing — so a dropped request costs nothing.
  wv.shouldAllowRequest = (request) => {
    const url = String((request && request.url) || "");
    if (!url.startsWith("wazn://")) return true;

    if (url.startsWith("wazn://open-site")) {
      Safari.open(SITE_URL);
      return false;
    }

    // Only reached when the WebView has no speech synthesis of its own. The
    // native API cannot be told which language to read in, so this is a
    // fallback rather than the preferred path.
    if (url.startsWith("wazn://speak")) {
      const m = url.match(/[?&]text=([^&]+)/);
      if (m) {
        try {
          Speech.speak(decodeURIComponent(m[1]));
        } catch (e) {
          /* no speech on this device — the word is still on screen */
        }
      }
      return false;
    }

    if (url.startsWith("wazn://grade")) {
      const idMatch = url.match(/[?&]id=([^&]+)/);
      const ratingMatch = url.match(/[?&]rating=([^&]+)/);
      if (idMatch && ratingMatch) {
        const id = decodeURIComponent(idMatch[1]);
        const rating = decodeURIComponent(ratingMatch[1]);
        const card = byId[id];
        if (card && !savedIds.has(id)) {
          savedIds.add(id);
          saveGrade(token, id, schedule(card, rating)).catch(() => {
            // Let the reconciling pass try again after dismissal.
            savedIds.delete(id);
          });
        }
      }
      return false;
    }

    return false;
  };

  // present() resolves when the sheet is dismissed, after which the page is
  // still alive and can be read. The full list of grades is read back then as
  // well as saved live above, so a session abandoned halfway still saves
  // everything graded up to that point — and there is no callback left
  // dangling if the user swipes down instead of reaching the end.
  await wv.present(true);

  let graded = [];
  try {
    const raw = await wv.evaluateJavaScript("JSON.stringify(results)", false);
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) graded = parsed;
  } catch {
    /* nothing graded, or the page was gone — treat as an empty session */
  }

  // Reconcile: re-send anything the live saves did not get through. Writing
  // the same grade twice is harmless, because the schedule is computed from
  // the card as it was fetched, not from its current stored value.
  for (const r of graded) {
    const card = byId[r.id];
    if (!card || savedIds.has(r.id)) continue;
    try {
      await saveGrade(token, card.id, schedule(card, r.rating));
      savedIds.add(r.id);
    } catch {
      /* keep going: one failed save should not lose the rest */
    }
  }

  const saved = savedIds.size;
  const stillDue = cards.filter((c) => !savedIds.has(c.id));
  writeCache({
    due: stillDue.length,
    word: stillDue.length ? stillDue[0].word : "",
    at: Date.now(),
  });

  if (saved > 0) {
    const a = new Alert();
    a.title = "Saved";
    a.message = `${saved} card${saved === 1 ? "" : "s"} updated.`;
    a.addAction("OK");
    await a.presentAlert();
  }
}

// ------------------------------------------------------------------ main

if (config.runsInWidget) {
  const cached = readCache();
  let state = cached
    ? { due: cached.due, word: cached.word }
    : { due: 0, word: "", error: "Open the script once to sign in." };

  try {
    const token = await signIn(false);
    if (token) {
      const cards = await fetchDueCards(token);
      state = { due: cards.length, word: cards.length ? cards[0].word : "" };
      writeCache({ ...state, at: Date.now() });
    } else if (!cached) {
      state = { due: 0, word: "", error: "Tap to sign in to Wazn." };
    }
  } catch {
    // Offline or the token failed: the cached counts are better than an error.
  }

  Script.setWidget(buildWidget(state));
  Script.complete();
} else {
  await runReview();
  Script.complete();
}
