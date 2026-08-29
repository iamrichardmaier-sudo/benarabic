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
 *            third for "Easy".
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
// Left blank in the repo on purpose: this repository is public, and a personal
// address committed here would be scraped from the file and from git history
// forever. Fill it in on your own copy in Scriptable instead — that copy lives
// on your device and is never pushed anywhere.
const DEFAULT_EMAIL = "";

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

async function fetchDueCards(token) {
  const columns = [
    "id", "word", "english", "image_url", "root", "word_type",
    "verb_form", "interval_days", "ease_factor", "next_review_date",
  ].join(",");
  const url =
    `${SUPABASE_URL}/rest/v1/flashcards` +
    `?select=${columns}` +
    `&learning_stage=eq.graduated` +
    `&next_review_date=lte.${isoDay()}` +
    `&order=next_review_date.asc`;

  const req = new Request(url);
  req.headers = restHeaders(token);
  const rows = await req.loadJSON();
  return Array.isArray(rows) ? rows : [];
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
  header { display:flex; align-items:center; gap:10px; padding:14px 16px 6px; }
  #bar { flex:1; height:5px; border-radius:3px; background:rgba(0,0,0,.09); overflow:hidden; }
  #fill { height:100%; width:0%; background:${BRAND}; transition:width .25s ease; }
  #count { font-size:12px; opacity:.55; font-variant-numeric:tabular-nums; }
  #quit { font-size:13px; color:${BRAND}; font-weight:600; padding:4px 2px; }
  main { flex:1; position:relative; display:flex; align-items:center;
         justify-content:center; padding:16px 22px; text-align:center; }
  .ar { font-size:56px; font-weight:700; direction:rtl; line-height:1.35; }
  .en { font-size:26px; opacity:.75; margin-top:14px; line-height:1.3; }
  .meta { font-size:13px; color:${BRAND}; margin-top:10px; font-weight:600; }
  img { max-width:78%; max-height:34vh; border-radius:14px; margin-top:16px; }
  #tip { position:absolute; bottom:14px; left:0; right:0;
         font-size:12px; opacity:.45; }
  /* Tap zones sit above the card. Before the flip the whole area flips;
     afterwards the outer thirds grade and the middle flips back. */
  .zones { position:absolute; inset:0; display:flex; }
  .zone { flex:1; }
  .zone.mid { flex:1.1; }
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
    <span id="quit">Swipe down to save</span>
    <div id="bar"><div id="fill"></div></div>
    <span id="count"></span>
  </header>
  <main>
    <div id="card"></div>
    <div id="tip">Tap to flip</div>
    <div class="zones">
      <div class="zone" data-act="again"></div>
      <div class="zone mid" data-act="flip"></div>
      <div class="zone" data-act="easy"></div>
    </div>
    <div id="flash"></div>
  </main>
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
  $('#card').innerHTML = '<div class="ar">' + esc(c.word) + '</div>';
  $('footer').style.visibility = 'hidden';
}

function flip() {
  const c = CARDS[i];
  if (!c) return;
  flipped = !flipped;
  if (!flipped) return render();
  let html = '<div class="ar">' + esc(c.word) + '</div>';
  if (c.english) html += '<div class="en">' + esc(c.english) + '</div>';
  const bits = [];
  if (c.root) bits.push(esc(c.root));
  if (c.verb_form) bits.push('Form ' + esc(c.verb_form));
  if (bits.length) html += '<div class="meta">' + bits.join(' · ') + '</div>';
  if (c.image_url) html += '<img src="' + esc(c.image_url) + '">';
  $('#card').innerHTML = html;
  $('#tip').textContent = 'Left = Again   ·   Right = Easy';
  $('footer').style.visibility = 'visible';
}

function grade(rating) {
  if (!flipped || !CARDS[i]) return;
  results.push({ id: CARDS[i].id, rating: rating });
  flash(rating === 'easy' ? 'Easy' : 'Again', rating === 'easy' ? '#2E7D52' : '#C0392B');
  i++;
  setTimeout(render, 170);
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
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;
  if (a === 'flip') { flip(); return; }
  if (!flipped) { flip(); return; }   // outer thirds flip too, before reveal
  grade(a);
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

  const wv = new WebView();
  await wv.loadHTML(reviewHTML(cards));

  // present() resolves when the sheet is dismissed, after which the page is
  // still alive and can be read. Grades are collected on the way out rather
  // than pushed as they happen, so a session abandoned halfway still saves
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

  const byId = Object.fromEntries(cards.map((c) => [c.id, c]));
  const savedIds = new Set();

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
