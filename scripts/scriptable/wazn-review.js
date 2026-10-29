// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: language;

/**
 * Wazn — home-screen review for Scriptable (iOS)
 * ---------------------------------------------------------------------------
 * Two modes in one file:
 *
 *   WIDGET   Shows how many cards are due and the next word's Arabic, drawn in
 *            the script and over the background chosen for this level. Tapping
 *            it launches the review session below; the Aa on a medium or
 *            large widget opens the font and background picker.
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
const SITE_URL = "https://waznarabic.com/";

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

// The front-loaded phase a newly-graduated card runs: four reps a day for
// three days, two a day for two more, spaced GAP_HOURS apart, then plain
// SM-2. Mirrors src/lib/intensive.ts in the web app — keep the two in step.
const REPS_PER_DAY = [4, 4, 4, 2, 2];
const GAP_HOURS = 3;
const EXIT_INTERVAL_DAYS = 3;

// ----------------------------------------------------------------- levels

// XP per graded card and the XP each level starts at. Mirrors XP_FOR_RATING
// and LEVEL_XP in src/lib/levels.ts — keep the two in step. Practice earns
// half, as in the web app.
const XP_FOR_RATING = { again: 3, hard: 6, good: 10, easy: 10 };
const LEVEL_XP = Array.from({ length: 15 }, (_, i) => 250 * i * i);

function xpFor(graded, practice) {
  let xp = 0;
  for (const r of graded) {
    const base = XP_FOR_RATING[r.rating] || 0;
    xp += practice ? Math.ceil(base / 2) : base;
  }
  return xp;
}

function levelFor(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) if (xp >= LEVEL_XP[i]) level = i + 1;
  return level;
}

/**
 * Sends one day's XP (add_xp in the database). `ok` is whether the database
 * took it; `total` is the new total when the reply could be read.
 */
async function sendXp(token, amount, day) {
  try {
    const req = new Request(`${SUPABASE_URL}/rest/v1/rpc/add_xp`);
    req.method = "POST";
    req.headers = restHeaders(token);
    // The local day it was earned, so it counts toward that day's goal and
    // streak in the app wherever the phone is.
    req.body = JSON.stringify({ amount: amount, study_day: day });
    // Read as text, not loadJSON(): add_xp answers with a bare number such
    // as 1270, which iOS's JSON parser refuses. That refusal used to look like
    // a failed save, so XP the database HAD taken was queued and sent again.
    // Success is judged by the HTTP status instead.
    const text = await req.loadString();
    const status = req.response ? Number(req.response.statusCode) : 0;
    if (!(status >= 200 && status < 300)) return { ok: false, total: null };
    const total = Number(String(text || "").trim());
    return { ok: true, total: Number.isFinite(total) ? total : null };
  } catch {
    return { ok: false, total: null };
  }
}

// XP not yet accepted by the database, by the day it was earned. It waits on
// the phone (in the Keychain) and is sent again after the next session, so
// being offline, or the database not being set up yet, never loses any.
const KEY_XP_PENDING = "wazn.xp-pending";

function readPendingXp() {
  try {
    const v = Keychain.contains(KEY_XP_PENDING) ? JSON.parse(Keychain.get(KEY_XP_PENDING)) : {};
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function writePendingXp(pending) {
  try {
    if (Object.keys(pending).length) Keychain.set(KEY_XP_PENDING, JSON.stringify(pending));
    else if (Keychain.contains(KEY_XP_PENDING)) Keychain.remove(KEY_XP_PENDING);
  } catch {
    /* kept in memory for this run only */
  }
}

// Set once the queue left by the version with the loadJSON bug has been
// checked against the database (see reconcilePendingXp).
const KEY_XP_CHECKED = "wazn.xp-queue-checked";

/**
 * One-off clean-up after the loadJSON bug. That version kept every session's
 * XP queued even though the database had taken it, and sent it again each
 * time. A queued day whose total in the database already covers it was
 * delivered, so it is dropped rather than sent yet again. If the database
 * cannot be asked, nothing is dropped and it is tried next time.
 */
async function reconcilePendingXp(token) {
  try {
    if (Keychain.contains(KEY_XP_CHECKED)) return;
  } catch {
    return;
  }
  const pending = readPendingXp();
  const days = Object.keys(pending).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (days.length) {
    try {
      const req = new Request(
        `${SUPABASE_URL}/rest/v1/user_study_days?select=day,xp&day=in.(${days.join(",")})`,
      );
      req.headers = restHeaders(token);
      const rows = await req.loadJSON();
      if (!Array.isArray(rows)) return; // not reachable now: check next time
      const onServer = {};
      for (const r of rows) onServer[r.day] = Number(r.xp) || 0;
      for (const d of days) {
        if ((onServer[d] || 0) >= (Number(pending[d]) || 0)) delete pending[d];
      }
      writePendingXp(pending);
    } catch {
      return;
    }
  }
  try {
    Keychain.set(KEY_XP_CHECKED, "1");
  } catch {
    /* checked again next time, which is harmless */
  }
}

/**
 * Queues this session's XP with anything still waiting, then sends it all.
 * Returns the new total (null if it could not be read) and how much is still
 * waiting.
 */
async function addXp(token, amount) {
  await reconcilePendingXp(token);
  const pending = readPendingXp();
  if (amount > 0) {
    const today = isoDay();
    pending[today] = (Number(pending[today]) || 0) + amount;
    writePendingXp(pending);
  }
  let total = null;
  for (const day of Object.keys(pending).sort()) {
    let left = Number(pending[day]) || 0;
    while (left > 0) {
      const chunk = Math.min(left, 2000); // add_xp takes at most 2000 per call
      const sent = await sendXp(token, chunk, day);
      if (!sent.ok) {
        writePendingXp(pending);
        return { total, waiting: Object.values(pending).reduce((a, b) => a + (Number(b) || 0), 0) };
      }
      if (sent.total !== null) total = sent.total;
      left -= chunk;
      if (left > 0) pending[day] = left;
      else delete pending[day];
      writePendingXp(pending);
    }
  }
  return { total, waiting: 0 };
}

/** The learner's XP, chosen background and chosen script, or null when unavailable. */
async function fetchProgress(token) {
  try {
    const req = new Request(`${SUPABASE_URL}/rest/v1/user_progress?select=xp,background,card_font`);
    req.headers = restHeaders(token);
    const rows = await req.loadJSON();
    if (!Array.isArray(rows)) return null;
    const r = rows[0] || {};
    return { xp: r.xp || 0, bg: r.background || null, font: r.card_font || null };
  } catch {
    return null;
  }
}

/** Calls a database function that answers with nothing. True when it was taken. */
async function callRpc(token, fn, body) {
  try {
    const req = new Request(`${SUPABASE_URL}/rest/v1/rpc/${fn}`);
    req.method = "POST";
    req.headers = restHeaders(token);
    req.body = JSON.stringify(body);
    await req.loadString();
    const status = req.response ? Number(req.response.statusCode) : 0;
    return status >= 200 && status < 300;
  } catch {
    return false;
  }
}

// Widget colours for each background in the app (src/components/backgrounds):
// page, text and accent, plus a second page colour for the night scenes.
// Add a row here when a background is added there.
const WIDGET_THEMES = {
  parchment: { bg: CREAM, ink: INK, accent: BRAND, name: "Parchment" },
  "star-lattice": { bg: CREAM, ink: INK, accent: BRAND, name: "Star Lattice" },
  trellis: { bg: CREAM, ink: INK, accent: "#A0522D", name: "Moroccan Trellis" },
  "hex-garden": { bg: CREAM, ink: INK, accent: "#8A6D1F", name: "Hexagon Garden" },
  khatam: { bg: CREAM, ink: INK, accent: "#B5651D", name: "Khatam" },
  zellige: { bg: "#FBF6EC", ink: INK, accent: "#1F7A74", name: "Zellige" },
  arabesque: { bg: CREAM, ink: INK, accent: "#5F7F3A", name: "Arabesque" },
  "arches-dusk": { bg: "#FBEEE2", ink: INK, accent: "#C0582F", name: "Arches at Dusk" },
  "lantern-glow": { bg: "#FDF5E4", ink: INK, accent: "#B8862A", name: "Lantern Glow" },
  "starry-night": { bg: "#26306B", bg2: "#0A0D24", ink: "#F3ECD8", accent: "#F2D48A", name: "Starry Night" },
  "desert-mosque": { bg: "#3B1F55", bg2: "#140A19", ink: "#F6E7DA", accent: "#F39C5A", name: "Desert Mosque" },
  "gold-girih": { bg: "#114747", bg2: "#082626", ink: "#F3ECD8", accent: "#D4AF37", name: "Gold Girih" },
  alhambra: { bg: "#22336B", bg2: "#0D1636", ink: "#EFE8D6", accent: "#E8D8A8", name: "Alhambra Courtyard" },
  "lantern-night": { bg: "#2B1650", bg2: "#120A24", ink: "#F6EAD2", accent: "#FFD27A", name: "Night of Lanterns" },
  "celestial-dome": { bg: "#3A1D52", bg2: "#1B1446", ink: "#FFF6D0", accent: "#D4AF37", name: "Celestial Dome" },
};

/** The id of the background to show: the chosen one, or plain when it is not unlocked yet. */
function widgetBgId(bg, xp) {
  const order = Object.keys(WIDGET_THEMES); // in level order, 1–15
  const id = bg || "parchment"; // null is the default plain one
  const i = order.indexOf(id);
  if (i < 0 || i + 1 > levelFor(xp || 0)) return "parchment";
  return id;
}

/** The theme for a background, falling back to plain when it is not unlocked yet. */
function widgetTheme(bg, xp) {
  return WIDGET_THEMES[widgetBgId(bg, xp)];
}

// The scripts a card's Arabic can be shown in, one unlocked per level.
// Mirrors CARD_FONTS in src/lib/card-fonts.ts (id, level, name, Google Fonts
// family) — keep the two in step; src/lib/levels.test.ts checks they match.
//
// `ios` is the nearest face iOS ships, used only when the real script cannot
// be drawn: the first refresh with no signal, or a refresh iOS cuts short.
// The real script is drawn from Google Fonts (see drawArabic below), so on
// any normal refresh the widget shows the same letters the app does.
const WIDGET_FONTS = [
  { id: "naskh", level: 1, name: "Naskh", blurb: "Clear everyday print", family: "Noto Naskh Arabic", ios: null },
  { id: "scheherazade", level: 2, name: "Scheherazade", blurb: "Roomy book Naskh", family: "Scheherazade New", ios: "TimesNewRomanPS-BoldMT" },
  { id: "amiri", level: 3, name: "Amiri", blurb: "Classic book Naskh", family: "Amiri", ios: "TimesNewRomanPS-BoldMT" },
  { id: "messiri", level: 4, name: "Messiri", blurb: "Round, open display face", family: "El Messiri", ios: "AlNile-Bold" },
  { id: "kufi", level: 5, name: "Kufi", blurb: "Square, geometric letters", family: "Reem Kufi", ios: "DamascusBold" },
  { id: "mushaf", level: 6, name: "Mu\u1e63\u1e25af Naskh", blurb: "Set like a printed mu\u1e63\u1e25af", family: "Amiri Quran", ios: "DiwanMishafi" },
  { id: "ruqah", level: 7, name: "Ruq\u02bfah", blurb: "Quick handwriting", family: "Aref Ruqaa", ios: "Farah" },
  { id: "kufam", level: 8, name: "Wide Kufi", blurb: "Long, light baselines", family: "Kufam", ios: "DamascusLight" },
  { id: "katibeh", level: 9, name: "Katibeh", blurb: "Tall, high-contrast display", family: "Katibeh", ios: "DamascusSemiBold" },
  { id: "nastaliq", level: 10, name: "Nasta\u02bfl\u012bq", blurb: "Sweeping, hanging script", family: "Gulzar", ios: "NotoNastaliqUrdu", tall: true },
  { id: "kano", level: 11, name: "Kano", blurb: "West African hand", family: "Alkalami", ios: "Farah" },
  { id: "vibes", level: 12, name: "Vibes", blurb: "Light, looping freehand", family: "Vibes", ios: "Farah" },
  { id: "rakkas", level: 13, name: "Rakkas", blurb: "Bold, dancing display", family: "Rakkas", ios: "DamascusBold" },
  { id: "jali-nastaliq", level: 14, name: "Jali Nasta\u02bfl\u012bq", blurb: "Nasta\u02bfl\u012bq at its grandest", family: "Noto Nastaliq Urdu", ios: "NotoNastaliqUrdu-Bold", tall: true },
  { id: "qahiri", level: 15, name: "Manuscript Kufi", blurb: "Early Qur\u02beanic Kufi", family: "Qahiri", ios: "DamascusBold" },
];

/** The script to show: the chosen one if the level allows it, else Naskh. */
function widgetFont(id, xp) {
  const f = WIDGET_FONTS.find((x) => x.id === id) || WIDGET_FONTS[0];
  return f.level <= levelFor(xp || 0) ? f : WIDGET_FONTS[0];
}

/** The iOS stand-in for a script, at a size. */
function fallbackFont(f, size) {
  if (!f || !f.ios) return Font.boldSystemFont(size);
  try {
    return new Font(f.ios, size);
  } catch {
    return Font.boldSystemFont(size);
  }
}

// ------------------------------------------------------------- the art

// The level backgrounds, drawn from the app's own art at the three widget
// sizes (scripts/widget-art/render.mjs) and served with the site. Fetched
// once per background and size, then kept in the cache folder. Bump the
// version when the art is re-rendered so phones fetch the new drawings.
const BG_ART_VERSION = 1;

/** "small" | "medium" | "large" — which rendering of the art fits this widget. */
function artSize() {
  const family = (typeof config !== "undefined" && config.widgetFamily) || "small";
  if (family === "medium") return "medium";
  if (family === "large" || family === "extraLarge") return "large";
  return "small";
}

function cacheDir(name) {
  const fm = FileManager.local();
  const dir = fm.joinPath(fm.cacheDirectory(), name);
  if (!fm.fileExists(dir)) fm.createDirectory(dir, true);
  return dir;
}

/** A background's art, from the cache or the site. Null for plain parchment, or offline on first use. */
async function backgroundArt(id, size) {
  if (!id || id === "parchment") return null;
  const fm = FileManager.local();
  const file = fm.joinPath(cacheDir("wazn-bg"), `v${BG_ART_VERSION}-${id}-${size}.jpg`);
  try {
    if (fm.fileExists(file)) return fm.readImage(file);
  } catch {
    /* a damaged cache file is fetched again below */
  }
  try {
    const img = await new Request(`${SITE_URL}widget/bg/${id}-${size}.jpg`).loadImage();
    fm.writeImage(file, img);
    return img;
  } catch {
    return null;
  }
}

// ------------------------------------------------------ drawing a script

// None of the level scripts ship with iOS, and a widget can only use fonts
// the system has. So the word is drawn rather than typeset: a hidden WebView
// loads the script from Google Fonts, draws the word onto a canvas, and hands
// back a PNG. Only the glyphs of the words being drawn are fetched (the
// `text=` subset), a few kilobytes, the same way the app's previews load.
//
// The page reports a job as failed rather than drawing it in a substitute
// face, so a script that did not arrive falls back to the iOS stand-in
// openly instead of passing off the wrong letters as the right ones.
const DRAW_JS = `
(async function () {
  const JOBS = __JOBS__;
  const out = JOBS.map(function () { return null; });
  let finished = false;
  function finish() { if (!finished) { finished = true; completion(JSON.stringify(out)); } }
  setTimeout(finish, __TIMEOUT__);
  try {
    await Promise.all(JOBS.map(function (j) {
      return document.fonts.load('400 ' + j.size + 'px "' + j.family + '"', j.text).catch(function () {});
    }));
    const ready = {};
    document.fonts.forEach(function (f) {
      if (f.status === 'loaded') ready[f.family.replace(/["']/g, '')] = true;
    });
    JOBS.forEach(function (j, n) {
      if (!ready[j.family]) return;
      const S = 3;
      const c = document.createElement('canvas');
      c.width = Math.round(j.width * S);
      c.height = Math.round(j.height * S);
      const ctx = c.getContext('2d');
      ctx.scale(S, S);
      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = j.color;
      // Shrink until the word fits both ways, measuring the ink itself:
      // vowel marks and the deep descenders of Nasta'liq go well outside a
      // font's nominal line, and a clipped mark is a misspelt word.
      let size = j.size, m = null;
      for (; size >= j.min; size -= 1) {
        ctx.font = '400 ' + size + 'px "' + j.family + '"';
        m = ctx.measureText(j.text);
        const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        const h = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
        if (w <= j.width * 0.96 && h <= j.height * 0.92) break;
      }
      const asc = m.actualBoundingBoxAscent, desc = m.actualBoundingBoxDescent;
      const x = j.width / 2 + (m.actualBoundingBoxLeft - m.actualBoundingBoxRight) / 2;
      ctx.fillText(j.text, x, j.height / 2 + (asc - desc) / 2);
      out[n] = c.toDataURL('image/png').split(',')[1];
    });
  } catch (e) {}
  finish();
})();
`;

/**
 * Draws Arabic in level scripts. Each job is { text, family, color, width,
 * height, size, min } in points; the answer is one Image per job, or null for
 * a job that could not be drawn.
 */
async function drawArabic(jobs, timeoutMs) {
  if (!jobs.length) return [];
  try {
    const glyphs = {};
    for (const j of jobs) glyphs[j.family] = (glyphs[j.family] || "") + j.text;
    const links = Object.keys(glyphs)
      .map((family) => {
        const text = [...new Set([...glyphs[family]])].join("");
        return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}&text=${encodeURIComponent(text)}&display=block">`;
      })
      .join("");
    const wv = new WebView();
    await wv.loadHTML(`<!doctype html><html><head><meta charset="utf-8">${links}</head><body></body></html>`, SITE_URL);
    const js = DRAW_JS.replace("__JOBS__", JSON.stringify(jobs)).replace("__TIMEOUT__", String(timeoutMs));
    const raw = await wv.evaluateJavaScript(js, true);
    const list = JSON.parse(raw || "[]");
    return jobs.map((_, n) => (list[n] ? Image.fromData(Data.fromBase64String(list[n])) : null));
  } catch {
    return jobs.map(() => null);
  }
}

/**
 * The widget's word, drawn in the chosen script. The last drawing is kept per
 * widget size, so a refresh that shows the same word in the same script
 * costs nothing.
 */
async function widgetWordImage(word, font, color, width, height) {
  if (!word) return null;
  const fm = FileManager.local();
  const dir = cacheDir("wazn-word");
  const size = artSize();
  const keyFile = fm.joinPath(dir, `${size}.json`);
  const imgFile = fm.joinPath(dir, `${size}.png`);
  const key = JSON.stringify([word, font.family, color, width, height]);
  try {
    if (fm.fileExists(keyFile) && fm.readString(keyFile) === key && fm.fileExists(imgFile)) {
      return fm.readImage(imgFile);
    }
  } catch {
    /* draw it again */
  }
  const [img] = await drawArabic(
    [{ text: word, family: font.family, color, width, height, size: font.tall ? 30 : 34, min: 14 }],
    9000,
  );
  if (img) {
    try {
      fm.writeImage(imgFile, img);
      fm.writeString(keyFile, key);
    } catch {
      /* drawn, just not kept */
    }
  }
  return img;
}

/** Room inside the widget for a full-width row, in points (padding taken off). */
function widgetContentWidth() {
  const family = (typeof config !== "undefined" && config.widgetFamily) || "small";
  return family === "medium" || family === "large" || family === "extraLarge" ? 290 : 124;
}

/** A thin rounded progress bar, drawn as an image. */
function barImage(fraction, color, track, width = 240, height = 8) {
  const ctx = new DrawContext();
  ctx.size = new Size(width, height);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  const r = height / 2;
  const back = new Path();
  back.addRoundedRect(new Rect(0, 0, width, height), r, r);
  ctx.addPath(back);
  ctx.setFillColor(track);
  ctx.fillPath();
  const w = Math.max(height, Math.round(width * Math.min(Math.max(fraction, 0), 1)));
  const front = new Path();
  front.addRoundedRect(new Rect(0, 0, w, height), r, r);
  ctx.addPath(front);
  ctx.setFillColor(color);
  ctx.fillPath();
  return ctx.getImage();
}

/** "+40 XP · Level 3", plus a note when the session reached a new level. */
function xpLine(earned, total, waiting) {
  if (earned <= 0 && !waiting) return "";
  if (waiting > 0) {
    return `\n\n+${earned} XP. Not saved yet: ${waiting} XP is waiting on this phone and will be sent after your next session.`;
  }
  if (total === null) return `\n\n+${earned} XP`;
  const level = levelFor(total);
  const before = levelFor(total - earned);
  let line = `\n\n+${earned} XP \u00b7 Level ${level}`;
  if (level > before) line += `\nLevel up! A new background and script are unlocked \u2014 tap Aa to try them.`;
  return line;
}

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

  // Inside the phase the rating moves the ease the card will carry out of it,
  // but the number of looks it gets is fixed, so the interval is ignored.
  if (card.intensive_day != null) {
    return { ...advanceIntensive(card), ease_factor: ease };
  }

  const next = new Date();
  next.setDate(next.getDate() + interval);

  return {
    interval_days: interval,
    ease_factor: ease,
    next_review_date: isoDay(next),
  };
}

/** Mirrors advanceIntensive() in src/lib/intensive.ts. */
function advanceIntensive(card) {
  const day = card.intensive_day;
  const reps = (card.intensive_reps_done || 0) + 1;
  const target = REPS_PER_DAY[day - 1] || 0;

  if (reps < target) {
    const at = new Date(Date.now() + GAP_HOURS * 60 * 60 * 1000);
    return {
      intensive_day: day,
      intensive_reps_done: reps,
      next_review_at: at.toISOString(),
      next_review_date: isoDay(at),
      interval_days: 1,
    };
  }

  // The day is done, so the date alone decides again.
  const nextDay = day + 1;
  const done = nextDay > REPS_PER_DAY.length;
  const next = new Date();
  next.setDate(next.getDate() + (done ? EXIT_INTERVAL_DAYS : 1));
  return {
    intensive_day: done ? null : nextDay,
    intensive_reps_done: 0,
    next_review_at: null,
    next_review_date: isoDay(next),
    interval_days: done ? EXIT_INTERVAL_DAYS : 1,
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
  "intensive_day", "intensive_reps_done", "next_review_at",
  "quran_example", "quran_example_en", "quran_reference",
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
  // A card in the front-loaded phase carries next_review_at as well as a
  // date, so that its several reps a day land spaced out rather than the
  // widget offering the same card again the moment it has been graded.
  const url =
    `${SUPABASE_URL}/rest/v1/flashcards` +
    `?select=${CARD_COLUMNS}` +
    `&learning_stage=eq.graduated` +
    `&next_review_date=lte.${isoDay()}` +
    `&or=(next_review_at.is.null,next_review_at.lte.${new Date().toISOString()})` +
    `&order=next_review_date.asc`;

  const req = new Request(url);
  req.headers = restHeaders(token);
  const rows = await req.loadJSON();
  return Array.isArray(rows) ? rows : [];
}

/** How far back "this week" reaches for the practice set. */
const RECENT_DAYS = 7;

/**
 * The words learned in the last week, due or not.
 *
 * The practice set: extra exposure on the words still settling, asked for
 * rather than scheduled. Mirrors learnedRecently() in the web app.
 */
async function fetchRecentCards(token) {
  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const url =
    `${SUPABASE_URL}/rest/v1/flashcards` +
    `?select=${CARD_COLUMNS}` +
    `&learning_stage=eq.graduated` +
    `&created_at=gte.${since}` +
    `&order=created_at.desc`;

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

/** The run URL for this script, optionally straight into one of its screens. */
function runUrl(mode) {
  const base = `scriptable:///run/${encodeURIComponent(Script.name())}`;
  return mode ? `${base}?mode=${mode}` : base;
}

function buildWidget(state, art) {
  const w = new ListWidget();
  const theme = widgetTheme(state.bg, state.xp);
  const ink = theme.ink;
  art = art || {};
  if (art.bg) {
    // The art carries its own colours; the flat ones stay as the fallback
    // underneath in case iOS ever draws the widget before the image.
    w.backgroundColor = new Color(theme.bg);
    w.backgroundImage = art.bg;
  } else if (theme.bg2) {
    const g = new LinearGradient();
    g.colors = [new Color(theme.bg), new Color(theme.bg2)];
    g.locations = [0, 1];
    w.backgroundGradient = g;
  } else {
    w.backgroundColor = new Color(theme.bg);
  }
  w.setPadding(14, 14, 14, 14);

  const header = w.addStack();
  header.centerAlignContent();
  const title = header.addText("WAZN");
  title.font = Font.boldSystemFont(11);
  title.textColor = new Color(theme.accent);
  header.addSpacer();

  if (state.due > 0) {
    const badge = header.addText(String(state.due));
    badge.font = Font.boldSystemFont(13);
    badge.textColor = new Color(theme.accent);
  }

  // Font and background, one tap away. Only on the larger sizes: iOS gives a
  // small widget a single tap target, which belongs to the review.
  if (artSize() !== "small") {
    header.addSpacer(10);
    const style = header.addStack();
    style.setPadding(2, 7, 2, 7);
    style.cornerRadius = 7;
    style.backgroundColor = new Color(theme.accent, 0.16);
    style.url = runUrl("style");
    const aa = style.addText("Aa");
    aa.font = Font.semiboldSystemFont(11);
    aa.textColor = new Color(theme.accent);
  }

  w.addSpacer(6);

  if (state.error) {
    const t = w.addText(state.error);
    t.font = Font.systemFont(12);
    t.textColor = new Color(ink);
    t.minimumScaleFactor = 0.7;
  } else if (state.due === 0) {
    const t = w.addText("All caught up");
    t.font = Font.semiboldSystemFont(15);
    t.textColor = new Color(ink);
    w.addSpacer(2);
    const s = w.addText("Nothing due right now.");
    s.font = Font.systemFont(11);
    s.textColor = new Color(ink);
    s.textOpacity = 0.6;
  } else {
    if (art.word) {
      const img = w.addImage(art.word);
      img.imageSize = art.wordSize;
      img.centerAlignImage();
    } else {
      const word = w.addText(state.word || "");
      word.font = fallbackFont(widgetFont(state.font, state.xp), 30);
      word.textColor = new Color(ink);
      word.centerAlignText();
      word.minimumScaleFactor = 0.5;
      word.lineLimit = 2;
    }

    w.addSpacer(4);
    const hint = w.addText(
      `${state.due} card${state.due === 1 ? "" : "s"} due · tap to review`,
    );
    hint.font = Font.systemFont(10);
    hint.textColor = new Color(ink);
    hint.textOpacity = 0.6;
    hint.centerAlignText();
  }

  w.addSpacer();

  // Level and the bar to the next one, in the chosen background's colours.
  if (typeof state.xp === "number") {
    const level = levelFor(state.xp);
    const floor = LEVEL_XP[level - 1];
    const next = level < LEVEL_XP.length ? LEVEL_XP[level] : null;
    const row = w.addStack();
    row.centerAlignContent();
    const lv = row.addText(`Level ${level}`);
    lv.font = Font.semiboldSystemFont(10);
    lv.textColor = new Color(theme.accent);
    row.addSpacer();
    const left = row.addText(next === null ? "Top level" : `${next - state.xp} XP to go`);
    left.font = Font.systemFont(9);
    left.textColor = new Color(ink);
    left.textOpacity = 0.6;
    w.addSpacer(3);
    // Sized to the widget: anything wider than the space inside a small
    // widget (about 130 points) stretches the whole widget, which then gets
    // cut off on both sides, text and all.
    const barWidth = widgetContentWidth();
    const bar = w.addImage(
      barImage(next === null ? 1 : (state.xp - floor) / (next - floor), new Color(theme.accent), new Color(ink, 0.15), barWidth, 6),
    );
    bar.imageSize = new Size(barWidth, 6);
  }

  // Tapping anywhere runs this same script, which then falls into review mode.
  w.url = runUrl();
  return w;
}

/** Everything the widget draws rather than types: the art, and the word in its script. */
async function widgetArt(state) {
  const art = { bg: null, word: null, wordSize: null };
  const theme = widgetTheme(state.bg, state.xp);
  const [bg, word] = await Promise.all([
    backgroundArt(widgetBgId(state.bg, state.xp), artSize()),
    state.due > 0 && state.word && !state.error
      ? (async () => {
          const width = widgetContentWidth();
          const height = artSize() === "large" ? 96 : 54;
          const img = await widgetWordImage(state.word, widgetFont(state.font, state.xp), theme.ink, width, height);
          if (img) art.wordSize = new Size(width, height);
          return img;
        })()
      : null,
  ]);
  art.bg = bg;
  art.word = word;
  return art;
}

// -------------------------------------------------------- review session

// The sentence chunk size last chosen on the slider ('all' = a tile per word,
// or a number of pieces), kept between sessions like the web app does.
const KEY_PIECES = "wazn.sentence-pieces";

function savedPieces() {
  try {
    const v = Keychain.contains(KEY_PIECES) ? Keychain.get(KEY_PIECES) : "all";
    const n = Number(v);
    return v !== "all" && Number.isInteger(n) && n >= 2 ? n : "all";
  } catch {
    return "all";
  }
}

/** CSS that sets the card's Arabic in the chosen script, as the app's cards are. */
function scriptCSS(font) {
  if (!font) return "";
  const family = `'${font.family}', -apple-system, system-ui, sans-serif`;
  // Only Naskh has a bold; the rest would be smeared by a fake one.
  const weight = font.id === "naskh" ? 700 : 400;
  return `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font.family).replace(/%20/g, "+")}:wght@400;700&display=swap">
<style>
  .ar, .tile, .row .val { font-family:${family}; }
  .ar { font-weight:${weight}; ${font.tall ? "line-height:1.9;" : ""} }
</style>`;
}

function reviewHTML(cards, practice, pieces, font) {
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
  .qur-ar { font-size:21px; direction:rtl; line-height:1.6; }
  .qur-en { font-size:13.5px; opacity:.7; line-height:1.4; margin-top:4px; }
  .qur-ref { font-size:11.5px; opacity:.45; margin-top:4px; }
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

  /* Sentence cards: put the words back in order (mirrors SentenceOrder.tsx). */
  .sq { padding:18px 16px; border-radius:18px; background:#fff;
        box-shadow:0 1px 6px rgba(0,0,0,.07); }
  .rd { font-size:10.5px; font-weight:700; letter-spacing:.09em; opacity:.45;
        text-transform:uppercase; }
  .sen { font-size:21px; line-height:1.35; margin-top:6px; }
  .hint { font-size:12px; opacity:.5; margin-top:6px; }
  .chunk { margin-top:14px; }
  .chl { display:flex; justify-content:space-between; align-items:baseline;
         font-size:11.5px; opacity:.6; }
  .chl b { font-size:12.5px; opacity:1; color:${INK}; }
  .chunk input { width:100%; margin:8px 0 0; accent-color:${BRAND}; }
  .ans { display:flex; flex-wrap:wrap; gap:8px; align-items:center;
         min-height:64px; margin-top:14px; padding:10px; border-radius:16px;
         border:1.5px dashed rgba(0,0,0,.18); background:rgba(0,0,0,.025); }
  .ans .empty { direction:ltr; font-size:13px; opacity:.45; padding:0 4px; }
  .bank { display:flex; flex-wrap:wrap; gap:8px; justify-content:center;
          margin-top:14px; }
  .tile { font-size:23px; line-height:1.5; padding:5px 12px; border-radius:13px;
          background:rgba(194,98,42,.12); color:${INK}; }
  .ans .tile { background:${BRAND}; color:#fff; }
  .tile.used { opacity:.22; }
  .srow { display:flex; gap:10px; margin-top:16px; }
  .sbtn { flex:1; padding:14px 0; border-radius:15px; font-size:16px;
          font-weight:700; text-align:center; background:${BRAND}; color:#fff; }
  .sbtn.ghost { flex:none; padding:14px 18px; background:transparent; color:${INK};
                border:1.5px solid rgba(0,0,0,.15); font-weight:600; }
  .sbtn.off { opacity:.35; }
  .ok, .bad { margin-top:16px; padding:12px 14px; border-radius:14px;
              font-weight:700; text-align:start; }
  .ok { background:rgba(46,125,82,.12); color:#2E7D52; }
  .bad { background:rgba(192,57,43,.1); color:#C0392B; }
  .bad .ar { color:${INK}; margin-top:6px; font-size:30px; text-align:center; }
  .result-next { margin-top:10px; }
  #style { flex:none; font-size:12px; font-weight:700; color:${BRAND};
           padding:4px 9px; border-radius:9px; background:rgba(194,98,42,.12); }
  #style.on { background:${BRAND}; color:#fff; }
</style>${scriptCSS(font)}</head>
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
    <span id="style" data-nav="style" title="Font and background">Aa</span>
  </header>
  <div id="quitline"><span id="quit">${practice ? "Practice \u00b7 nothing is rescheduled" : "Swipe down when you\u2019re done"}</span></div>
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
// Set by the Aa button. A page cannot close itself, so the choice is read
// after the session is swiped away, and the picker opens then.
let wantStyle = false;
let i = 0, flipped = false;

/* ------------------------------------------------------- sentence cards */

// A sentence is not flipped and graded: its exercise is putting the words
// back in order, twice with a fresh shuffle, as in the web app's review.
// The slider joins neighbouring words into bigger chunks, down to two pieces.
const SENT_ROUNDS = 2;
let PIECES = ${JSON.stringify(pieces || "all")};
let S = null;

function isSentence(c) { return Boolean(c) && c.word_type === 'sentence'; }

const EDGE = /^[\\s\u061F?!.,\u060C\u061B;:"'\u201C\u201D\u00AB\u00BB()]+|[\\s\u061F?!.,\u060C\u061B;:"'\u201C\u201D\u00AB\u00BB()]+$/g;
function tokenize(text) {
  return String(text || '').split(/\\s+/).map((t) => t.replace(EDGE, '')).filter((t) => t.length > 0);
}
/** Mirrors normalizeArabic() in the web app: harakat, tatweel and the usual
 *  letter variants do not count against an answer. */
function norm(t) {
  return String(t).replace(/\u0640/g, '').replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627').replace(/\u0649/g, '\u064A')
    .replace(/\u0629/g, '\u0647').trim().replace(/\\s+/g, ' ');
}
/** Mirrors chunkWords(): neighbouring words in even runs, longer first. */
function chunk(words, pieces) {
  const n = words.length;
  if (n <= 2) return words.slice();
  const m = Math.min(Math.max(Math.round(pieces), 2), n);
  const base = Math.floor(n / m), extra = n % m, out = [];
  let at = 0;
  for (let k = 0; k < m; k++) {
    const size = base + (k < extra ? 1 : 0);
    out.push(words.slice(at, at + size).join(' '));
    at += size;
  }
  return out;
}
/** A shuffle that is never already the answer, when another order exists. */
function shuffleTiles(tiles) {
  const solved = tiles.map(norm).join(' ');
  const solvable = new Set(tiles.map(norm)).size > 1;
  let out = tiles.slice();
  for (let attempt = 0; attempt < 20; attempt++) {
    out = tiles.slice();
    for (let k = out.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      const tmp = out[k]; out[k] = out[j]; out[j] = tmp;
    }
    if (!solvable || out.map(norm).join(' ') !== solved) return out;
  }
  return solvable ? tiles.slice(1).concat([tiles[0]]) : out;
}
function piecesLabel() {
  return S.pieces >= S.words.length ? 'Every word' : S.pieces + ' pieces';
}

function startSentence(c) {
  const words = tokenize(c.word_voweled || c.word);
  const pieces = PIECES === 'all' ? words.length : Math.min(Math.max(PIECES, 2), words.length);
  S = { card: c, words: words, pieces: pieces, round: 1, placed: [], result: 'idle', tiles: [] };
  S.tiles = shuffleTiles(chunk(words, pieces));
  drawSentence();
}

function drawSentence() {
  let h = '<div class="sq"><div class="rd">Round ' + S.round + ' of ' + SENT_ROUNDS + '</div>' +
    '<div class="sen">' + esc(S.card.english || '\u2014') + '</div>' +
    '<div class="hint">Tap the words in order, right to left.</div>';
  if (S.words.length > 2) {
    h += '<div class="chunk"><div class="chl"><span>Bigger chunks</span><b id="plabel">' + piecesLabel() +
      '</b><span>Every word</span></div><input id="pieces" type="range" min="2" max="' + S.words.length +
      '" step="1" value="' + S.pieces + '" aria-label="Chunk size"></div>';
  }
  h += '</div><div id="stiles"></div>';
  $('#card').innerHTML = h;
  const range = $('#pieces');
  if (range) range.addEventListener('input', () => setPieces(Number(range.value)));
  drawTiles();
}

/** Everything below the slider, redrawn on each tap so the slider keeps its drag. */
function drawTiles() {
  const open = S.result === 'idle';
  let h = '<div class="ans" dir="rtl">';
  S.placed.forEach((t, at) => { h += '<span class="tile" data-s="un" data-i="' + at + '">' + esc(S.tiles[t]) + '</span>'; });
  if (!S.placed.length) h += '<span class="empty">Your sentence goes here</span>';
  h += '</div>';
  if (open) {
    h += '<div class="bank" dir="rtl">';
    S.tiles.forEach((t, k) => {
      h += '<span class="tile' + (S.placed.indexOf(k) >= 0 ? ' used' : '') + '" data-s="pl" data-i="' + k + '">' + esc(t) + '</span>';
    });
    h += '</div><div class="srow"><div class="sbtn ghost" data-s="clear">Clear</div>' +
      '<div class="sbtn' + (S.placed.length === S.tiles.length ? '' : ' off') + '" data-s="check">Check</div></div>';
  } else if (S.result === 'right') {
    h += '<div class="ok">Correct!</div>' +
      '<div class="sbtn result-next" data-s="next">' + (S.round < SENT_ROUNDS ? 'Next round' : 'Continue') + '</div>';
  } else {
    h += '<div class="bad">Not quite. The sentence is:<div class="ar" dir="rtl">' +
      esc(S.card.word_voweled || S.card.word) + '</div></div>' + speaker() +
      '<div class="sbtn result-next" data-s="next">Continue</div>';
  }
  $('#stiles').innerHTML = h;
  const range = $('#pieces');
  if (range) range.disabled = !open;
}

function setPieces(v) {
  if (!S || S.result !== 'idle' || v === S.pieces) return;
  S.pieces = v;
  PIECES = v >= S.words.length ? 'all' : v;
  ping('pieces?v=' + PIECES);
  S.tiles = shuffleTiles(chunk(S.words, v));
  S.placed = [];
  $('#plabel').textContent = piecesLabel();
  drawTiles();
}

function sentenceAct(act, k) {
  if (!S) return;
  if (S.result === 'idle') {
    if (act === 'pl' && S.placed.indexOf(k) < 0) S.placed.push(k);
    else if (act === 'un') S.placed.splice(k, 1);
    else if (act === 'clear') S.placed = [];
    else if (act === 'check') {
      if (S.placed.length !== S.tiles.length) return;
      const got = [];
      S.placed.forEach((t) => { S.tiles[t].split(' ').forEach((w) => { if (w) got.push(norm(w)); }); });
      const ok = got.length === S.words.length && S.words.every((w, at) => norm(w) === got[at]);
      S.result = ok ? 'right' : 'wrong';
      say(spoken(S.card));
    }
    drawTiles();
    return;
  }
  if (act !== 'next') return;
  if (S.result === 'wrong') { flipped = true; grade('again'); return; }
  if (S.round < SENT_ROUNDS) {
    S.round += 1;
    S.tiles = shuffleTiles(chunk(S.words, S.pieces));
    S.placed = [];
    S.result = 'idle';
    drawSentence();
    return;
  }
  flipped = true;
  grade('easy');
}

const $ = (s) => document.querySelector(s);

function render() {
  const c = CARDS[i];
  if (!c) return finishScreen();
  flipped = false;
  $('#tip').textContent = 'Tap to flip';
  $('#count').textContent = (i + 1) + '/' + CARDS.length;
  $('#fill').style.width = ((i / CARDS.length) * 100) + '%';
  if (isSentence(c)) {
    // No reading aloud here: hearing the sentence would give the order away.
    $('#tip').textContent = '';
    $('footer').style.visibility = 'hidden';
    $('#scroll').scrollTop = 0;
    startSentence(c);
    return;
  }
  S = null;
  $('#card').innerHTML = '<div class="ar">' + esc(c.word) + '</div>' + speaker();
  $('#scroll').scrollTop = 0;
  $('footer').style.visibility = 'hidden';
  say(spoken(c));
}

function flip() {
  const c = CARDS[i];
  if (!c || isSentence(c)) return;
  flipped = !flipped;
  if (!flipped) return render();
  let html = '<div class="ar sm">' + esc(c.word_voweled || c.word) + '</div>' + speaker();
  if (c.english) html += '<div class="en">' + esc(c.english) + '</div>';
  html += detail(c);
  if (c.image_url) html += '<img src="' + esc(c.image_url) + '">';
  // Last of all, under the picture too, so the answer ends with the verse.
  html += quranRef(c);
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

/** The verse, if the word has one. Skipped words are stored as '' and read as
 *  absent, same as null. */
function quranRef(c) {
  if (!c.quran_example) return '';
  let body = '<div class="qur-ar" dir="rtl">' + esc(c.quran_example) + '</div>';
  if (c.quran_example_en) body += '<div class="qur-en">' + esc(c.quran_example_en) + '</div>';
  if (c.quran_reference) body += '<div class="qur-ref">' + esc(c.quran_reference) + '</div>';
  return '<div class="detail">' + section('Quranic reference', body) + '</div>';
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
  const card = CARDS[i];
  results.push({ id: card.id, rating: rating });
  // Hand the grade to Scriptable straight away so it reaches the database
  // while the session is still open, rather than only on the way out. The
  // sequence number is what the native side dedupes on: keying by card id
  // would throw away the second grade of a card that came round again.
  ping('grade?id=' + encodeURIComponent(card.id) + '&rating=' + rating +
       '&seq=' + (results.length - 1));
  flash(rating === 'easy' ? 'Easy' : 'Again', rating === 'easy' ? '#2E7D52' : '#C0392B');
  if (rating === 'again') {
    // Didn't know it: to the back of the deck, so it comes round again this
    // session instead of disappearing until tomorrow.
    CARDS.splice(i, 1);
    CARDS.push(card);
  } else {
    i++;
  }
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
  if (e.target.closest('[data-nav="style"]')) {
    wantStyle = !wantStyle;
    $('#style').classList.toggle('on', wantStyle);
    $('#quit').textContent = wantStyle
      ? 'Font & background open when you swipe down'
      : (${practice ? "'Practice \u00b7 nothing is rescheduled'" : "'Swipe down when you\u2019re done'"});
    return;
  }
  const st = e.target.closest('[data-s]');
  if (st) { sentenceAct(st.dataset.s, Number(st.dataset.i)); return; }
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
  if (e.target.closest('[data-act],[data-nav],[data-s],input')) return;
  // A sentence is answered with its tiles, never by tapping the card.
  if (isSentence(CARDS[i])) return;
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

  let due, recent;
  try {
    [due, recent] = await Promise.all([fetchDueCards(token), fetchRecentCards(token)]);
  } catch (e) {
    const a = new Alert();
    a.title = "Could not load cards";
    a.message = String(e);
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  // The widget face counts what is owed, so it is written from the due set
  // whichever session is chosen. The level shown on it is kept as it was.
  const prior = readCache() || {};
  writeCache({
    due: due.length,
    word: due.length ? due[0].word : "",
    xp: prior.xp,
    bg: prior.bg,
    font: prior.font,
    at: Date.now(),
  });

  if (due.length === 0 && recent.length === 0) {
    const a = new Alert();
    a.title = "All caught up";
    a.message = "Nothing is due, and nothing new this week to run again.";
    a.addAction("OK");
    a.addAction("Font & background");
    if ((await a.presentAlert()) === 1) await runStyle(token);
    return;
  }

  // Both on offer: ask. One of them: go straight in, since a menu with a
  // single item is a tap for nothing.
  let practice = due.length === 0;
  if (due.length > 0 && recent.length > 0) {
    const a = new Alert();
    a.title = "What would you like to do?";
    a.message = `${due.length} due \u00b7 ${recent.length} learned this week`;
    a.addAction(`Review ${due.length} due`);
    a.addAction(`Practise this week\u2019s ${recent.length}`);
    a.addCancelAction("Cancel");
    const choice = await a.presentAlert();
    if (choice === -1) return;
    practice = choice === 1;
  }

  const cards = practice ? recent : due;

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
  // Grades are deduped by their position in the session, not by card id: a
  // card answered "Again" comes round again and is graded a second time, and
  // that second grade must not be mistaken for a replay of the first.
  const savedSeqs = new Set();
  const gradedIds = new Set();
  let saveQueue = Promise.resolve();

  const wv = new WebView();
  const look = readCache() || {};
  await wv.loadHTML(reviewHTML(cards, practice, savedPieces(), widgetFont(look.font, look.xp)));

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

    if (url.startsWith("wazn://pieces")) {
      const m = url.match(/[?&]v=([^&]+)/);
      if (m) {
        try {
          Keychain.set(KEY_PIECES, decodeURIComponent(m[1]));
        } catch (e) {
          /* the slider just starts at every word next time */
        }
      }
      return false;
    }

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
      const seqMatch = url.match(/[?&]seq=(\d+)/);
      if (idMatch && ratingMatch) {
        const id = decodeURIComponent(idMatch[1]);
        const rating = decodeURIComponent(ratingMatch[1]);
        const seq = seqMatch ? Number(seqMatch[1]) : savedSeqs.size;
        const card = byId[id];
        // Practice writes nothing at all. The point of it is extra exposure
        // on demand, and moving the schedule here would push this week's
        // words further out every time the set was run again.
        if (card && !practice && !savedSeqs.has(seq)) {
          savedSeqs.add(seq);
          gradedIds.add(id);
          // Chained rather than fired loose: a card answered "Again" and then
          // "Easy" produces two writes for one row, and the later one has to
          // be the one that lands.
          saveQueue = saveQueue
            .then(() => saveGrade(token, id, schedule(card, rating)))
            .catch(() => {
              // Let the reconciling pass try again after dismissal.
              savedSeqs.delete(seq);
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

  let wantStyle = false;
  try {
    wantStyle = (await wv.evaluateJavaScript("String(wantStyle)", false)) === "true";
  } catch {
    /* the page was gone; nothing was asked for */
  }

  let graded = [];
  try {
    const raw = await wv.evaluateJavaScript("JSON.stringify(results)", false);
    const parsed = JSON.parse(raw || "[]");
    if (Array.isArray(parsed)) graded = parsed;
  } catch {
    /* nothing graded, or the page was gone — treat as an empty session */
  }

  // Reconcile: re-send anything the live saves did not get through, in the
  // order they were made, so the last grade of a repeated card wins. Writing
  // the same grade twice is harmless, because the schedule is computed from
  // the card as it was fetched, not from its current stored value.
  for (let seq = 0; seq < graded.length; seq++) {
    if (practice) break;
    const r = graded[seq];
    const card = byId[r.id];
    if (!card || savedSeqs.has(seq)) continue;
    try {
      await saveGrade(token, card.id, schedule(card, r.rating));
      savedSeqs.add(seq);
      gradedIds.add(r.id);
    } catch {
      /* keep going: one failed save should not lose the rest */
    }
  }

  // XP for every grade, sent in one call. It does not depend on the saves
  // above: the cards were studied either way.
  const earned = xpFor(graded, practice);
  const sent = await addXp(token, earned);
  const total = sent.total;
  const xpNote = xpLine(earned, total, sent.waiting);

  // A card whose last answer was "Again" was never really cleared, even
  // though a grade was written for it, so it still counts as due.
  const lastRating = {};
  for (const r of graded) lastRating[r.id] = r.rating;
  const clearedIds = new Set(
    [...gradedIds].filter((id) => lastRating[id] !== "again"),
  );

  if (practice) {
    // Nothing was written, so the widget's count is still whatever the due
    // set said before the session, and must not be recomputed from this one.
    const seen = new Set(graded.map((r) => r.id)).size;
    if (seen > 0) {
      const a = new Alert();
      a.title = "Practice done";
      a.message = `${seen} word${seen === 1 ? "" : "s"} run again. Your schedule is unchanged.` + xpNote;
      a.addAction("OK");
      await a.presentAlert();
    }
    if (wantStyle) await runStyle(token);
    return;
  }

  const saved = clearedIds.size;
  const stillDue = cards.filter((c) => !clearedIds.has(c.id));
  const before = readCache() || {};
  writeCache({
    due: stillDue.length,
    word: stillDue.length ? stillDue[0].word : "",
    xp: total !== null ? total : before.xp,
    bg: before.bg,
    font: before.font,
    at: Date.now(),
  });

  if (saved > 0 || earned > 0) {
    const a = new Alert();
    a.title = "Saved";
    a.message = `${saved} card${saved === 1 ? "" : "s"} updated.` + xpNote;
    a.addAction("OK");
    await a.presentAlert();
  }
  if (wantStyle) await runStyle(token);
}

// ------------------------------------------------- font and background

/**
 * The picker for the two things a level unlocks: the background behind the
 * widget, and the script the cards are written in. Both are saved to the
 * account (set_background, set_card_font), so the app follows a choice made
 * here and the widget follows one made in the app.
 */
async function runStyle(token) {
  token = token || (await signIn(true));
  if (!token) {
    const a = new Alert();
    a.title = "Could not sign in";
    a.message = "Check your email and password, then run the script again.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  const cached = readCache() || {};
  const progress = await fetchProgress(token);
  const xp = progress ? progress.xp : cached.xp || 0;
  const level = levelFor(xp);
  let bg = widgetBgId(progress ? progress.bg : cached.bg, xp);
  let font = widgetFont(progress ? progress.font : cached.font, xp).id;

  const ids = Object.keys(WIDGET_THEMES);
  const SAMPLE = "\u0643\u0650\u062a\u064e\u0627\u0628\u064c"; // كِتَابٌ, as in the app's picker
  const word = cached.word || SAMPLE;

  // Everything is drawn before the table opens: a UITable cannot wait on a
  // network call per row. The previews are the word in every script, in
  // both inks, so switching between light and night art redraws nothing.
  const LIGHT = INK;
  const NIGHT = "#F6EAD2";
  const jobs = [];
  for (const f of WIDGET_FONTS) {
    jobs.push({ text: SAMPLE, family: f.family, color: LIGHT, width: 92, height: 46, size: 26, min: 12 });
  }
  for (const f of WIDGET_FONTS) {
    for (const color of [LIGHT, NIGHT]) {
      jobs.push({ text: word, family: f.family, color, width: 300, height: 74, size: f.tall ? 34 : 40, min: 14 });
    }
  }
  const [drawn, thumbs, wide] = await Promise.all([
    drawArabic(jobs, 15000),
    Promise.all(ids.map((id) => backgroundArt(id, "small"))),
    Promise.all(ids.map((id) => backgroundArt(id, "medium"))),
  ]);
  const sample = {};
  const preview = {};
  WIDGET_FONTS.forEach((f, n) => {
    sample[f.id] = drawn[n];
    preview[f.id] = { [LIGHT]: drawn[WIDGET_FONTS.length + n * 2], [NIGHT]: drawn[WIDGET_FONTS.length + n * 2 + 1] };
  });

  /** The widget as it will look, at medium size. */
  function previewImage() {
    const theme = WIDGET_THEMES[bg];
    const ink = theme.bg2 ? NIGHT : LIGHT;
    const W = 364;
    const H = 170;
    const ctx = new DrawContext();
    ctx.size = new Size(W, H);
    ctx.respectScreenScale = true;
    ctx.opaque = false;
    const clip = new Path();
    clip.addRoundedRect(new Rect(0, 0, W, H), 22, 22);
    ctx.addPath(clip);
    ctx.setFillColor(new Color(theme.bg2 || theme.bg));
    ctx.fillPath();
    const art = wide[ids.indexOf(bg)];
    if (art) ctx.drawImageInRect(art, new Rect(0, 0, W, H));
    ctx.setFont(Font.boldSystemFont(11));
    ctx.setTextColor(new Color(theme.accent));
    ctx.drawText("WAZN", new Point(16, 14));
    const img = preview[font] && preview[font][ink];
    if (img) {
      ctx.drawImageInRect(img, new Rect((W - 300) / 2, (H - 74) / 2, 300, 74));
    } else {
      ctx.setFont(fallbackFont(widgetFont(font, xp), 34));
      ctx.setTextColor(new Color(theme.ink));
      ctx.setTextAlignedCenter();
      ctx.drawTextInRect(word, new Rect(16, (H - 50) / 2, W - 32, 50));
    }
    ctx.setFont(Font.semiboldSystemFont(10));
    ctx.setTextColor(new Color(theme.accent));
    ctx.setTextAlignedLeft();
    ctx.drawText(`Level ${level}`, new Point(16, H - 26));
    return ctx.getImage();
  }

  const PAGE = new Color(CREAM);
  const DIM = new Color(INK, 0.38);
  const table = new UITable();
  table.showSeparators = true;

  async function choose(kind, id) {
    const before = kind === "bg" ? bg : font;
    if (kind === "bg") bg = id;
    else font = id;
    render();
    const ok =
      kind === "bg"
        ? await callRpc(token, "set_background", { background_id: id === "parchment" ? null : id })
        : await callRpc(token, "set_card_font", { font_id: id });
    if (!ok) {
      if (kind === "bg") bg = before;
      else font = before;
      render();
      const a = new Alert();
      a.title = "Not saved";
      a.message = "That change could not be saved. Check your connection and try again.";
      a.addAction("OK");
      await a.presentAlert();
    }
  }

  async function locked(what, at) {
    const a = new Alert();
    a.title = `Unlocks at level ${at}`;
    a.message = `You are level ${level}. Keep reviewing to unlock this ${what}.`;
    a.addAction("OK");
    await a.presentAlert();
  }

  function heading(text) {
    const r = new UITableRow();
    r.height = 44;
    r.backgroundColor = PAGE;
    const c = r.addText(text.toUpperCase());
    c.titleFont = Font.boldSystemFont(11);
    c.titleColor = new Color(INK, 0.5);
    return r;
  }

  function check(r, on) {
    const c = r.addText(on ? "\u2713" : "");
    c.widthWeight = 12;
    c.rightAligned();
    c.titleFont = Font.boldSystemFont(17);
    c.titleColor = new Color(BRAND);
  }

  function render() {
    table.removeAllRows();

    const top = new UITableRow();
    top.height = 200;
    top.backgroundColor = PAGE;
    top.isHeader = true;
    const pic = top.addImage(previewImage());
    pic.centerAligned();
    table.addRow(top);

    table.addRow(heading("Background"));
    ids.forEach((id, n) => {
      const theme = WIDGET_THEMES[id];
      const open = n + 1 <= level;
      const r = new UITableRow();
      r.height = 64;
      r.backgroundColor = PAGE;
      r.dismissOnSelect = false;
      const thumb = thumbs[n];
      if (thumb) {
        const c = r.addImage(thumb);
        c.widthWeight = 16;
      } else {
        const c = r.addText("");
        c.widthWeight = 16;
      }
      const t = r.addText(theme.name, open ? `Level ${n + 1}` : `Unlocks at level ${n + 1}`);
      t.widthWeight = 72;
      t.titleFont = Font.semiboldSystemFont(16);
      t.titleColor = open ? new Color(INK) : DIM;
      t.subtitleFont = Font.systemFont(12);
      t.subtitleColor = DIM;
      check(r, id === bg);
      r.onSelect = () => (open ? choose("bg", id) : locked("background", n + 1));
      table.addRow(r);
    });

    table.addRow(heading("Script"));
    WIDGET_FONTS.forEach((f) => {
      const open = f.level <= level;
      const r = new UITableRow();
      r.height = 64;
      r.backgroundColor = PAGE;
      r.dismissOnSelect = false;
      const img = sample[f.id];
      if (img && open) {
        const c = r.addImage(img);
        c.widthWeight = 26;
      } else {
        const c = r.addText(open ? SAMPLE : "\u{1F512}");
        c.widthWeight = 26;
        c.centerAligned();
        c.titleFont = open ? fallbackFont(f, 22) : Font.systemFont(16);
        c.titleColor = new Color(INK);
      }
      const t = r.addText(f.name, open ? f.blurb : `Unlocks at level ${f.level}`);
      t.widthWeight = 62;
      t.titleFont = Font.semiboldSystemFont(16);
      t.titleColor = open ? new Color(INK) : DIM;
      t.subtitleFont = Font.systemFont(12);
      t.subtitleColor = DIM;
      check(r, f.id === font);
      r.onSelect = () => (open ? choose("font", f.id) : locked("script", f.level));
      table.addRow(r);
    });

    table.reload();
  }

  render();
  await table.present(false);

  // The widget picks the choice up on its next refresh; the cache makes that
  // refresh right even if it has no signal.
  const now = readCache() || {};
  writeCache({ ...now, xp, bg: bg === "parchment" ? null : bg, font, at: Date.now() });
}

// ------------------------------------------------------------------ main

if (config.runsInWidget) {
  const cached = readCache();
  let state = cached
    ? { due: cached.due, word: cached.word, xp: cached.xp, bg: cached.bg, font: cached.font }
    : { due: 0, word: "", error: "Open the script once to sign in." };

  try {
    const token = await signIn(false);
    if (token) {
      const [cards, progress] = await Promise.all([fetchDueCards(token), fetchProgress(token)]);
      state = { due: cards.length, word: cards.length ? cards[0].word : "" };
      if (progress) {
        state.xp = progress.xp;
        state.bg = progress.bg;
        state.font = progress.font;
      } else if (cached) {
        state.xp = cached.xp;
        state.bg = cached.bg;
        state.font = cached.font;
      }
      writeCache({ ...state, at: Date.now() });
    } else if (!cached) {
      state = { due: 0, word: "", error: "Tap to sign in to Wazn." };
    }
  } catch {
    // Offline or the token failed: the cached counts are better than an error.
  }

  // The art and the drawn word are extras: if either fails the widget still
  // shows, in flat colours and the nearest iOS face.
  let art = null;
  try {
    art = await widgetArt(state);
  } catch {
    art = null;
  }
  Script.setWidget(buildWidget(state, art));
  Script.complete();
} else if (args.queryParameters && args.queryParameters.mode === "style") {
  await runStyle(null);
  Script.complete();
} else {
  await runReview();
  Script.complete();
}
