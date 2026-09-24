// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: orange; icon-glyph: podcast;

/**
 * Wazn Podcasts — browse and listen, for Scriptable (iOS)
 * ---------------------------------------------------------------------------
 * Two modes in one file, the same split as wazn-review.js:
 *
 *   WIDGET   Shows how many podcasts exist and the newest one's title.
 *            Tapping it opens the browse list below.
 *
 *   IN APP   A native list of every podcast, its cover mark drawn on the fly,
 *            its two runtimes shown. Tapping one asks Shaami, Fusha, or both
 *            back to back, then opens that choice in Safari.
 *
 * Why this hands off to Safari rather than playing audio itself: keeping a
 * podcast going with the screen locked needs a page that registers with the
 * Media Session API and an <audio> element that is never torn down, which is
 * exactly what the web app's player already does and this session verified
 * works. Rebuilding that inside Scriptable would be a second, untested copy
 * of the one part of this app where "mostly works" is a real regression from
 * silence — a session that goes quiet the moment the phone locks is worse
 * than one that never claimed to keep playing. Browsing and choosing stay
 * native and instant; the minute of actual listening is one tap into the
 * page already built and checked for it.
 *
 * SETUP
 *   1. Scriptable -> + -> paste this file -> name it "Wazn Podcasts".
 *   2. Run it once. If you already use wazn-review.js on this device, it is
 *      already signed in -- both scripts read the same Keychain entry. If
 *      not, it asks for your Wazn email and password once, the same way.
 *   3. Home screen -> add a Scriptable widget -> choose this script.
 *      Set "When Interacting" to "Run Script".
 */

// ---------------------------------------------------------------- config
//
// Everything in this section is copied verbatim from wazn-review.js rather
// than shared. Two Scriptable files have no module system between them --
// importModule() would run the other script's own sign-in-and-review flow
// as a side effect -- so, as that file's own README says of the SM-2 maths,
// this is a deliberate duplication and not an accidental one. Change one,
// change both.

const SUPABASE_URL = "https://fphpcfecgnfoogfaeihu.supabase.co";
// Publishable anon key -- the same value the web app ships to browsers. It is
// not a secret; row-level security is what actually protects the data.
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaHBjZmVjZ25mb29nZmFlaWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzY2NjAsImV4cCI6MjA5OTk1MjY2MH0.2OXlbp8EuQpgv0Mnk5Ps3XbL16-vI8vDDRTWi4yYOk4";

// Pre-fills the email box on first run so only the password has to be typed.
// Note this repository is public, so this address is visible in the file and
// in git history. The password is deliberately NOT here -- the Keychain
// holds it after the first run.
const DEFAULT_EMAIL = "rbm66@byu.edu";

// The live site. A podcast tap opens SITE_URL + "?podcast=<id>&register=<r>",
// which the app reads on load to jump straight to that podcast's player --
// see the deep-link effect in src/pages/Index.tsx.
const SITE_URL = "https://waznarabic.com/";

// Same Keychain keys as wazn-review.js, on purpose: signing in on either
// script signs in on both.
const KEY_EMAIL = "wazn.email";
const KEY_PASSWORD = "wazn.password";
const CACHE_FILE = "wazn-podcasts-cache.json";

const BRAND = "#C2622A";
const CREAM = "#FDF8F2";
const INK = "#2B2118";

// ------------------------------------------------------------------ auth
//
// Identical to wazn-review.js. See that file for the reasoning in comments.

async function credentials(promptIfMissing) {
  if (Keychain.contains(KEY_EMAIL) && Keychain.contains(KEY_PASSWORD)) {
    return { email: Keychain.get(KEY_EMAIL), password: Keychain.get(KEY_PASSWORD) };
  }
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
    if (promptIfMissing) forgetCredentials();
    return null;
  }
  return res.access_token;
}

function restHeaders(token) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// ------------------------------------------------------------------ data

const PODCAST_COLUMNS = [
  "id", "title", "subtitle", "icon",
  "shaami_url", "fusha_url", "shaami_seconds", "fusha_seconds",
].join(",");

async function fetchPodcasts(token) {
  const req = new Request(
    `${SUPABASE_URL}/rest/v1/podcasts?select=${PODCAST_COLUMNS}&order=sort_order.asc,created_at.asc`,
  );
  req.headers = restHeaders(token);
  const rows = await req.loadJSON();
  if (!Array.isArray(rows)) throw new Error("Podcasts could not be loaded.");
  return rows;
}

/** Mirrors available() in src/lib/podcasts.ts. Keep the two in step. */
function available(p) {
  const out = [];
  if (p.shaami_url) out.push("shaami");
  if (p.fusha_url) out.push("fusha");
  if (p.shaami_url && p.fusha_url) out.push("both");
  return out;
}

const REGISTER_LABEL = { shaami: "Shaami", fusha: "Fusha", both: "Both, back to back" };

/** Mirrors lengthOf() in src/lib/podcasts.ts. */
function lengthOf(p) {
  const a = p.shaami_seconds;
  const b = p.fusha_seconds;
  if (a != null && b != null) return a + b;
  return a != null ? a : b;
}

/** Mirrors clock() in src/lib/podcasts.ts. */
function clock(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "--:--";
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
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

// ----------------------------------------------------------------- cover
//
// The mihrab mark from the app's own icon set (src/components/icons/WaznIcon
// .tsx), pre-flattened: every curved arch and arc in that drawing became a
// short run of straight-line points, generated once and pasted in below,
// because Scriptable's Path draws lines, not SVG arcs. Rendered fresh at
// whatever size is asked for, so the widget's small mark and the browse
// list's larger one are the same drawing, not two assets to keep in sync.

const MIHRAB_SUBPATHS = [
  [[7.00,38.00],[7.00,19.57],[7.84,18.14],[8.74,16.76],[9.71,15.42],[10.74,14.12],[11.84,12.89],[12.99,11.70],[14.20,10.57],[15.47,9.51],[16.78,8.50],[18.15,7.56],[19.55,6.69],[21.00,5.89],[22.48,5.16],[24.00,4.50],[25.52,5.16],[27.00,5.89],[28.45,6.69],[29.85,7.56],[31.22,8.50],[32.53,9.51],[33.80,10.57],[35.01,11.70],[36.16,12.89],[37.26,14.12],[38.29,15.42],[39.26,16.76],[40.16,18.14],[41.00,19.57],[41.00,38.00]],
  [[13.50,38.00],[13.50,26.75],[13.94,25.71],[14.44,24.70],[14.99,23.72],[15.59,22.77],[16.24,21.85],[16.94,20.97],[17.68,20.13],[18.47,19.33],[19.30,18.57],[20.17,17.86],[21.08,17.19],[22.02,16.58],[23.00,16.01],[24.00,15.50],[25.00,16.01],[25.98,16.58],[26.92,17.19],[27.83,17.86],[28.70,18.57],[29.53,19.33],[30.32,20.13],[31.06,20.97],[31.76,21.85],[32.41,22.77],[33.01,23.72],[33.56,24.70],[34.06,25.71],[34.50,26.75],[34.50,38.00]],
  [[24.00,7.30],[25.91,11.91],[21.30,10.00],[25.91,8.09],[24.00,12.70],[22.09,8.09],[26.70,10.00],[22.09,11.91],[24.00,7.30]],
  [[12.50,38.00],[12.50,26.50]],
  [[12.50,27.00],[14.30,28.40],[12.50,29.90],[10.70,28.40],[12.50,27.00]],
  [[12.50,30.80],[14.30,32.20],[12.50,33.70],[10.70,32.20],[12.50,30.80]],
  [[12.50,34.60],[14.30,36.10],[12.50,37.50],[10.70,36.10],[12.50,34.60]],
  [[35.50,38.00],[35.50,26.50]],
  [[35.50,27.00],[37.30,28.40],[35.50,29.90],[33.70,28.40],[35.50,27.00]],
  [[35.50,30.80],[37.30,32.20],[35.50,33.70],[33.70,32.20],[35.50,30.80]],
  [[35.50,34.60],[37.30,36.10],[35.50,37.50],[33.70,36.10],[35.50,34.60]],
  [[19.70,22.90],[20.32,23.28],[20.87,23.75],[21.33,24.29],[21.71,24.91],[21.99,25.58],[22.16,26.28],[22.21,27.00],[22.16,27.72],[21.99,28.42],[21.71,29.09],[21.33,29.71],[20.87,30.25],[20.32,30.72],[19.70,31.10]],
  [[20.90,20.60],[21.86,21.19],[22.71,21.93],[23.44,22.78],[24.02,23.74],[24.45,24.78],[24.71,25.88],[24.80,27.00],[24.71,28.12],[24.45,29.22],[24.02,30.26],[23.44,31.22],[22.71,32.07],[21.86,32.81],[20.90,33.40]],
  [[22.10,18.30],[23.40,19.11],[24.55,20.11],[25.54,21.27],[26.33,22.58],[26.92,23.99],[27.27,25.48],[27.39,27.00],[27.27,28.52],[26.92,30.01],[26.33,31.42],[25.54,32.73],[24.55,33.89],[23.40,34.89],[22.10,35.70]],
];

function podcastGlyph(size, hexColor) {
  // Transparent, not opaque: every place this gets used already draws its
  // own background (the widget's cream, a table cell's default), so this is
  // just the stroke, free to sit on top of whatever that is.
  const ctx = new DrawContext();
  ctx.size = new Size(size, size);
  ctx.opaque = false;
  ctx.respectScreenScale = true;
  ctx.setStrokeColor(new Color(hexColor));
  // The drawing is on a 48x48 grid; scale the stroke with it so it does not
  // come out hairline-thin at large sizes or blotchy at small ones.
  ctx.setLineWidth(Math.max(1, (size / 48) * 2.1));

  for (const points of MIHRAB_SUBPATHS) {
    const path = new Path();
    const scale = size / 48;
    path.move(new Point(points[0][0] * scale, points[0][1] * scale));
    for (let i = 1; i < points.length; i++) {
      path.addLine(new Point(points[i][0] * scale, points[i][1] * scale));
    }
    ctx.addPath(path);
    ctx.strokePath();
  }
  return ctx.getImage();
}

// ---------------------------------------------------------------- widget

function buildWidget(state) {
  const w = new ListWidget();
  w.backgroundColor = new Color(CREAM);
  w.setPadding(14, 14, 14, 14);

  const header = w.addStack();
  header.centerAlignContent();
  const mark = header.addImage(podcastGlyph(34, BRAND));
  mark.imageSize = new Size(17, 17);
  header.addSpacer(6);
  const title = header.addText("WAZN");
  title.font = Font.boldSystemFont(11);
  title.textColor = new Color(BRAND);
  header.addSpacer();

  if (state.count > 0) {
    const badge = header.addText(String(state.count));
    badge.font = Font.boldSystemFont(13);
    badge.textColor = new Color(BRAND);
  }

  w.addSpacer(8);

  if (state.error) {
    const t = w.addText(state.error);
    t.font = Font.systemFont(12);
    t.textColor = new Color(INK);
    t.minimumScaleFactor = 0.7;
  } else if (state.count === 0) {
    const t = w.addText("No podcasts yet");
    t.font = Font.semiboldSystemFont(15);
    t.textColor = new Color(INK);
    w.addSpacer(2);
    const s = w.addText("Add one from the web app.");
    s.font = Font.systemFont(11);
    s.textColor = new Color(INK);
    s.textOpacity = 0.6;
  } else {
    const name = w.addText(state.title || "");
    name.font = Font.boldSystemFont(17);
    name.textColor = new Color(INK);
    name.minimumScaleFactor = 0.6;
    name.lineLimit = 2;

    w.addSpacer(4);
    const hint = w.addText(
      `${state.count} podcast${state.count === 1 ? "" : "s"} · tap to browse`,
    );
    hint.font = Font.systemFont(10);
    hint.textColor = new Color(INK);
    hint.textOpacity = 0.6;
  }

  w.addSpacer();
  w.url = `scriptable:///run?scriptName=${encodeURIComponent(Script.name())}`;
  return w;
}

// ------------------------------------------------------------- browse UI

/** Opens the register picker for one podcast, then hands off to Safari. */
async function choosePodcast(p) {
  const choices = available(p);
  if (choices.length === 0) {
    const a = new Alert();
    a.title = p.title;
    a.message = "The audio for this one has not been uploaded yet.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  const a = new Alert();
  a.title = p.title;
  a.message = "Listen in:";
  for (const c of choices) a.addAction(`${REGISTER_LABEL[c]} · ${clock(c === "both" ? lengthOf(p) : p[`${c}_seconds`])}`);
  a.addCancelAction("Cancel");
  const choice = await a.presentAlert();
  if (choice === -1) return;

  const register = choices[choice];
  const url = `${SITE_URL}?podcast=${encodeURIComponent(p.id)}&register=${register}`;
  Safari.open(url);
}

async function runBrowsePodcasts(token) {
  let podcasts;
  try {
    podcasts = await fetchPodcasts(token);
  } catch (e) {
    const a = new Alert();
    a.title = "Could not load podcasts";
    a.message = String((e && e.message) || e);
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  writeCache({
    count: podcasts.length,
    title: podcasts.length ? podcasts[podcasts.length - 1].title : "",
    at: Date.now(),
  });

  if (podcasts.length === 0) {
    const a = new Alert();
    a.title = "No podcasts yet";
    a.message = "Add one from the web app and it will show up here.";
    a.addAction("OK");
    await a.presentAlert();
    return;
  }

  const table = new UITable();
  table.showSeparators = true;

  const header = new UITableRow();
  header.isHeader = true;
  header.height = 60;
  const headerImg = header.addImage(podcastGlyph(64, BRAND));
  headerImg.widthWeight = 18;
  const headerText = header.addText("WAZN Podcasts", "Tap one to choose Shaami, Fusha, or both");
  headerText.widthWeight = 82;
  headerText.titleColor = new Color(BRAND);
  headerText.titleFont = Font.boldSystemFont(16);
  header.dismissOnSelect = false;
  header.onSelect = () => Safari.open(SITE_URL);
  table.addRow(header);

  for (const p of podcasts) {
    const row = new UITableRow();
    row.height = 64;
    row.dismissOnSelect = false;

    const img = row.addImage(podcastGlyph(56, BRAND));
    img.widthWeight = 18;

    const text = row.addText(p.title, p.subtitle || "");
    text.widthWeight = 62;
    text.titleFont = Font.semiboldSystemFont(15);
    text.titleColor = new Color(INK);
    text.subtitleColor = Color.dynamic(new Color(INK, 0.55), new Color(CREAM, 0.55));

    const len = row.addText(clock(lengthOf(p)));
    len.widthWeight = 20;
    len.rightAligned();
    len.titleColor = Color.dynamic(new Color(INK, 0.55), new Color(CREAM, 0.55));
    len.titleFont = Font.systemFont(12);

    // Not awaited -- UITable calls onSelect while the table is still on
    // screen, and there is nothing above this to await it into. Caught
    // explicitly instead, so a dropped connection mid-tap surfaces as an
    // alert rather than as a silent, console-only rejection.
    row.onSelect = () => {
      choosePodcast(p).catch((e) => {
        const a = new Alert();
        a.title = "Could not open that";
        a.message = String((e && e.message) || e);
        a.addAction("OK");
        a.presentAlert();
      });
    };
    table.addRow(row);
  }

  await table.present(true);
}

// ------------------------------------------------------------------ main

try {
  if (config.runsInWidget) {
    const cached = readCache();
    let state = cached
      ? { count: cached.count, title: cached.title }
      : { count: 0, title: "", error: "Open the script once to sign in." };

    try {
      const token = await signIn(false);
      if (token) {
        const podcasts = await fetchPodcasts(token);
        state = { count: podcasts.length, title: podcasts.length ? podcasts[podcasts.length - 1].title : "" };
        writeCache({ ...state, at: Date.now() });
      } else if (!cached) {
        state = { count: 0, title: "", error: "Tap to sign in to Wazn." };
      }
    } catch {
      // Offline or the token failed: the cached count is better than an error.
    }

    Script.setWidget(buildWidget(state));
    Script.complete();
  } else {
    const token = await signIn(true);
    if (!token) {
      const a = new Alert();
      a.title = "Not signed in";
      a.message = "Wazn Podcasts needs your account to list what you have uploaded.";
      a.addAction("OK");
      await a.presentAlert();
    } else {
      await runBrowsePodcasts(token);
    }
    Script.complete();
  }
} catch (e) {
  // A visible error beats a silent "Script Error" from the Shortcuts app --
  // this is the one place in the file allowed to catch everything, because
  // there is nothing further downstream that could do anything useful with it.
  const a = new Alert();
  a.title = "Wazn Podcasts hit a problem";
  a.message = String((e && e.stack) || e);
  a.addAction("OK");
  await a.presentAlert();
  Script.complete();
}
