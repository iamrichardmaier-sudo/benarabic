// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: book-open;

/**
 * Wazn — Arabic verse of the day (Scriptable, iOS)
 * ---------------------------------------------------------------------------
 * A home-screen widget showing one Old Testament verse a day in Arabic, with
 * the English underneath. Tapping it opens a larger, readable view.
 *
 * ON THE VERSE SOURCE — worth reading before changing anything
 *
 * The Church of Jesus Christ of Latter-day Saints does not publish an API for
 * its daily verse; this is stated by its own developers on the Church tech
 * forum. Scraping the website for it would be brittle (any markup change
 * breaks it silently) and is not clearly permitted by their terms.
 *
 * So this widget does not scrape. It follows the same *principle* instead:
 * 2026 is the Old Testament year in the Come, Follow Me cycle, so the rotation
 * below is drawn entirely from the Old Testament. The verse changes once per
 * day and is the same all day on every device, because it is chosen from the
 * calendar date rather than at random.
 *
 * Only verse REFERENCES are listed here. The words themselves are fetched from
 * Wazn's own Bible files — Smith & Van Dyke Arabic (1865) and the King James
 * Version, both long in the public domain. Nothing is reproduced from any
 * copyrighted edition.
 *
 * This widget never touches the database, so it keeps working even when the
 * Supabase project is paused.
 *
 * SETUP
 *   1. Scriptable → + → paste this file → name it "Wazn Verse".
 *   2. Home screen → add a Scriptable widget → choose this script.
 *      Set "When Interacting" to "Run Script".
 */

// ---------------------------------------------------------------- config

// Where Wazn's static Bible files live. Update this when the custom domain is
// pointed at the site; the path after the origin stays the same.
const BASE_URL = "https://iamrichardmaier-sudo.github.io/benarabic";

const BRAND = "#C2622A";
const CREAM = "#FDF8F2";
const INK = "#2B2118";
const CACHE_FILE = "wazn-verse-cache.json";

// Old Testament rotation: [book code, chapter, verse, display name].
// Book codes match the filenames under /bible/.
const VERSES = [
  ["Gen", 1, 1, "Genesis"],        ["Gen", 1, 27, "Genesis"],
  ["Gen", 8, 22, "Genesis"],       ["Gen", 28, 15, "Genesis"],
  ["Exod", 14, 14, "Exodus"],      ["Exod", 15, 2, "Exodus"],
  ["Exod", 20, 12, "Exodus"],      ["Lev", 19, 18, "Leviticus"],
  ["Num", 6, 24, "Numbers"],       ["Deut", 6, 5, "Deuteronomy"],
  ["Deut", 31, 6, "Deuteronomy"],  ["Deut", 31, 8, "Deuteronomy"],
  ["Josh", 1, 9, "Joshua"],        ["Josh", 24, 15, "Joshua"],
  ["Ruth", 1, 16, "Ruth"],         ["1Sam", 16, 7, "1 Samuel"],
  ["2Sam", 22, 31, "2 Samuel"],    ["1Kgs", 8, 57, "1 Kings"],
  ["2Kgs", 6, 16, "2 Kings"],      ["1Chr", 16, 11, "1 Chronicles"],
  ["1Chr", 28, 9, "1 Chronicles"], ["2Chr", 7, 14, "2 Chronicles"],
  ["Neh", 8, 10, "Nehemiah"],      ["Job", 19, 25, "Job"],
  ["Job", 23, 10, "Job"],          ["Ps", 1, 1, "Psalm"],
  ["Ps", 19, 1, "Psalm"],          ["Ps", 23, 1, "Psalm"],
  ["Ps", 27, 1, "Psalm"],          ["Ps", 34, 8, "Psalm"],
  ["Ps", 37, 4, "Psalm"],          ["Ps", 46, 1, "Psalm"],
  ["Ps", 46, 10, "Psalm"],         ["Ps", 51, 10, "Psalm"],
  ["Ps", 55, 22, "Psalm"],         ["Ps", 91, 1, "Psalm"],
  ["Ps", 100, 4, "Psalm"],         ["Ps", 118, 24, "Psalm"],
  ["Ps", 119, 105, "Psalm"],       ["Ps", 121, 1, "Psalm"],
  ["Ps", 133, 1, "Psalm"],         ["Ps", 139, 14, "Psalm"],
  ["Ps", 147, 3, "Psalm"],         ["Prov", 3, 5, "Proverbs"],
  ["Prov", 3, 6, "Proverbs"],      ["Prov", 4, 23, "Proverbs"],
  ["Prov", 15, 1, "Proverbs"],     ["Prov", 16, 3, "Proverbs"],
  ["Prov", 17, 17, "Proverbs"],    ["Prov", 22, 6, "Proverbs"],
  ["Prov", 27, 17, "Proverbs"],    ["Eccl", 3, 1, "Ecclesiastes"],
  ["Eccl", 4, 9, "Ecclesiastes"],  ["Isa", 1, 18, "Isaiah"],
  ["Isa", 6, 8, "Isaiah"],         ["Isa", 9, 6, "Isaiah"],
  ["Isa", 26, 3, "Isaiah"],        ["Isa", 40, 31, "Isaiah"],
  ["Isa", 41, 10, "Isaiah"],       ["Isa", 43, 2, "Isaiah"],
  ["Isa", 53, 5, "Isaiah"],        ["Isa", 55, 8, "Isaiah"],
  ["Isa", 58, 11, "Isaiah"],       ["Jer", 1, 5, "Jeremiah"],
  ["Jer", 29, 11, "Jeremiah"],     ["Jer", 31, 3, "Jeremiah"],
  ["Jer", 33, 3, "Jeremiah"],      ["Lam", 3, 22, "Lamentations"],
  ["Lam", 3, 23, "Lamentations"],  ["Ezek", 36, 26, "Ezekiel"],
  ["Hos", 6, 3, "Hosea"],          ["Joel", 2, 25, "Joel"],
  ["Amos", 5, 24, "Amos"],         ["Jonah", 2, 2, "Jonah"],
  ["Mic", 6, 8, "Micah"],          ["Zeph", 3, 17, "Zephaniah"],
  ["Zech", 4, 6, "Zechariah"],     ["Mal", 3, 10, "Malachi"],
];

// ------------------------------------------------------------- selection

/** Local calendar day as yyyy-mm-dd. Using UTC would flip the verse over at
 *  the wrong hour for anyone west of Greenwich. */
function isoDay(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Days since the epoch, from the LOCAL date, so every device in a timezone
 *  agrees on which verse today is. */
function dayNumber(d = new Date()) {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

function verseForToday() {
  return VERSES[dayNumber() % VERSES.length];
}

// ------------------------------------------------------------------ data

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
    /* a stale verse beats failing the widget refresh */
  }
}

async function loadVerse() {
  const [code, chapter, verse, name] = verseForToday();
  const ref = `${name} ${chapter}:${verse}`;
  const today = isoDay();

  const cached = readCache();
  if (cached && cached.day === today && cached.ref === ref) return cached;

  const req = new Request(`${BASE_URL}/bible/${code}/${chapter}.json`);
  req.timeoutInterval = 15;
  const rows = await req.loadJSON();
  if (!Array.isArray(rows)) throw new Error("Unexpected chapter format");

  const row = rows.find((r) => r.v === verse);
  if (!row) throw new Error(`${ref} not found in that chapter`);

  const data = { day: today, ref, arabic: row.a, english: row.e };
  writeCache(data);
  return data;
}

// ---------------------------------------------------------------- widget

function buildWidget(data, size) {
  const w = new ListWidget();
  w.backgroundColor = new Color(CREAM);
  w.setPadding(14, 14, 14, 14);
  w.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}`;

  const head = w.addStack();
  head.centerAlignContent();
  const brand = head.addText("WAZN");
  brand.font = Font.boldSystemFont(10);
  brand.textColor = new Color(BRAND);
  head.addSpacer();
  const ref = head.addText(data.ref);
  ref.font = Font.semiboldSystemFont(10);
  ref.textColor = new Color(BRAND);

  w.addSpacer(8);

  if (data.error) {
    const t = w.addText(data.error);
    t.font = Font.systemFont(12);
    t.textColor = new Color(INK);
    t.minimumScaleFactor = 0.7;
    return w;
  }

  // Arabic is the point of the widget, so it gets the room. The small size
  // cannot fit both languages legibly, so it shows Arabic alone.
  const small = size === "small";
  const ar = w.addText(data.arabic);
  ar.font = Font.mediumSystemFont(small ? 15 : 19);
  ar.textColor = new Color(INK);
  ar.rightAlignText();
  ar.minimumScaleFactor = 0.45;
  ar.lineLimit = small ? 5 : 4;

  if (!small) {
    w.addSpacer(7);
    const en = w.addText(data.english);
    en.font = Font.systemFont(12);
    en.textColor = new Color(INK);
    en.textOpacity = 0.62;
    en.minimumScaleFactor = 0.6;
    en.lineLimit = 3;
  }

  w.addSpacer();
  return w;
}

// ------------------------------------------------------------ full view

function fullHTML(data) {
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"]/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]
    ));

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>
  html,body{margin:0;height:100%;background:${CREAM};color:${INK};
    font-family:-apple-system,system-ui,sans-serif;
    display:flex;align-items:center;justify-content:center;padding:26px;}
  .wrap{max-width:640px;text-align:center;}
  .brand{font-size:12px;font-weight:800;letter-spacing:.16em;color:${BRAND};}
  .ref{font-size:15px;font-weight:600;color:${BRAND};margin-top:4px;}
  .ar{direction:rtl;font-size:30px;line-height:1.85;margin:26px 0 20px;font-weight:500;}
  .en{font-size:17px;line-height:1.55;opacity:.62;}
  .src{margin-top:30px;font-size:11px;opacity:.4;line-height:1.5;}
</style></head>
<body><div class="wrap">
  <div class="brand">WAZN</div>
  <div class="ref">${esc(data.ref)}</div>
  <div class="ar">${esc(data.arabic)}</div>
  <div class="en">${esc(data.english)}</div>
  <div class="src">Smith &amp; Van Dyke Arabic (1865) · King James Version<br>Both public domain</div>
</div></body></html>`;
}

// ------------------------------------------------------------------ main

let data;
try {
  data = await loadVerse();
} catch (e) {
  const cached = readCache();
  const [, chapter, verse, name] = verseForToday();
  data = cached || {
    ref: `${name} ${chapter}:${verse}`,
    arabic: "",
    english: "",
    error: "Couldn't load today's verse. Check the connection.",
  };
}

if (config.runsInWidget) {
  Script.setWidget(buildWidget(data, config.widgetFamily || "medium"));
} else {
  const wv = new WebView();
  await wv.loadHTML(fullHTML(data));
  await wv.present(true);
}
Script.complete();
