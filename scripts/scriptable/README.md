# Wazn — Scriptable widget & review session (iOS)

`wazn-review.js` is a single file that behaves two ways depending on where it runs.

| Where | What it does |
|---|---|
| **Home-screen widget** | Shows how many cards are due and the next word in Arabic. Tapping it launches the review session. |
| **Run in Scriptable** | A full-screen review session: tap the middle to flip, then the **left** third for *Again* and the **right** third for *Easy*. Words are read aloud, and the answer side shows the same word detail as the web app, ending with a **Quranic reference** (verse, translation, citation) when the word has one. |

## Why the reviewing isn't inside the widget

iOS only lets a Scriptable widget respond to a tap by **opening a URL**. A widget cannot
re-render in place, so a card cannot flip on the home screen. iOS 17 added genuinely
interactive widgets (`Button` + App Intents), but **Scriptable does not expose that API** —
so this isn't a limitation of this script, it's the platform surface Scriptable has.

One tap from the home screen into a real session is as close as iOS currently allows.

## Setup

1. Open **Scriptable** → **+** → paste the contents of `wazn-review.js`.
2. Name it **Wazn Review** (the widget deep-links to itself by script name — if you
   rename it, the widget still works, since the name is read at runtime).
3. **Run it once.** It asks for your Wazn email and password and stores them in the iOS
   **Keychain** on that device. They are not written into the script or to any file.

   `DEFAULT_EMAIL` near the top pre-fills the address so only the password has to be
   typed. Change it if you sign in with a different account:

   ```js
   const DEFAULT_EMAIL = "you@example.com";
   ```

   Note that **this repository is public**, so whatever address is set there is visible in
   the file and in git history. If you would rather it weren't, either blank it out here and
   set it only in your Scriptable copy on the device, or make the repository private.

   **Never put the password in the file.** After the first run the Keychain already holds
   it, and a credential sitting in a script is one screenshot or screen-share away from
   being exposed.
4. Long-press the home screen → **+** → **Scriptable** → pick a size.
5. Long-press the placed widget → **Edit Widget**:
   - **Script** → *Wazn Review*
   - **When Interacting** → **Run Script**

## Using it

- **Tap the middle** — flip the card.
- **Tap the left third** — *Again*. The card goes to the back of the deck and comes round
  again before the session ends, so you get another go at it straight away rather than
  waiting for tomorrow. It still records the lapse; answering it the second time overwrites
  that with the real grade.
- **Tap the right third** — *Easy* (longest interval).
- Before the card is flipped, tapping anywhere flips it — you can't grade an answer you
  haven't seen.
- **Scroll** the answer when it runs past the screen. A tap that ends a scroll doesn't
  grade, so you can read the whole entry before deciding.
- **Tap the WAZN logo** at the top — opens the web app in Safari.
- **Swipe down** to finish. Everything graded up to that point is saved, so a session you
  abandon halfway still counts.

## What each card shows

Every word is **read aloud** when it appears and again when it's flipped; the speaker
button under the word replays it. The web app's `ar-SA` voice and slowed rate are used
where the device has an Arabic voice — vowelled Arabic at full speed is hard to catch.
The vowelled spelling is what gets read, since the bare one pronounces badly.

Flipping a card shows what the web app shows, in the same order:

| Section | Where it comes from |
|---|---|
| Root · Form · part of speech | the card's own tags |
| **Its other forms** | plural, Shaami, Shaami plural, past, present, masdar |
| **Word family** | the card's companion forms — the same root in other patterns |
| **Same root in your deck** | other cards you're learning built on that root |
| **Same root in the Bible** | tagged words from the Bible corpus sharing the root |
| **Other Form N words you know** | your cards in the same verb form |

A section that has nothing to show is left out rather than shown empty, so a bare card
still looks like a bare card. A word never appears twice across the sections — the first
one to claim it keeps it, which is why a root whose whole family is already listed under
*Word family* usually shows nothing under *Same root in your deck*.

All of this is fetched **before** the session opens, in two extra requests: your whole
deck, and the Bible words for the roots that came up. The review page cannot make network
calls of its own, so everything it will ever show has to be in hand first. If either
request fails the review still runs — it just loses the cross-references.

*Hard* and *Good* aren't offered here by design — a two-choice pass is what makes a
phone-sized session fast. Use the web app when you want the full four-way rating.

## How it stays in sync with the web app

There is no second copy of the data. The script reads and writes the **same Supabase
`flashcards` rows the website uses**, as the same signed-in user, so sync is not something
it maintains — it is just where the data lives. A card graded on the phone is already
graded for the browser, and vice versa.

Each grade is sent the moment it's made, not held until the session ends. The page can't
call into Scriptable directly, so it navigates to a `wazn://grade?...` URL that the native
side intercepts and blocks; after dismissal a reconciling pass re-sends anything that
didn't get through, which is safe because each schedule is computed from the card as it was
fetched rather than from its stored value.

**The home-screen widget is the one part that can lag.** iOS decides when a widget
refreshes — a few minutes is normal — so the due count on the home screen may trail the
database briefly after a session. Nothing the script does can force it sooner.

Scheduling is a direct port of `reviewCard()` in `src/lib/spaced-repetition.ts` — the same
SM-2 interval and ease maths, the same 1.3–2.5 ease clamp, the same local-calendar-day
handling. Grades made on the phone and grades made in the browser produce identical
schedules.

### Practising this week's words

Running the script with words due *and* words learned in the last seven days asks which you
want. **Review** is the day's schedule as usual. **Practise** runs this week's words again
whether or not any of them are due.

Practice changes nothing on the schedule — not the grades, not the intervals, not the widget's count (it does earn half XP; see below). The
point of it is extra exposure on demand, and moving the schedule there would push this
week's words further out every time you ran the set again. The page says
*Practice · nothing is rescheduled* along the top so there is never a question of whether
it counted.

If only one of the two has anything in it, the script goes straight into that one rather
than showing a menu with a single item.

### Sentence cards

A sentence card is not flipped. As in the web app, the English is the question and the
Arabic words are tiles to tap into order, right to left. It runs twice with a fresh shuffle;
both right is *Easy*, a miss is *Again*. The slider above the tiles joins neighbouring words
into bigger chunks, from one tile per word down to two pieces, and the script remembers the
setting (in the Keychain) for the next sentence. The sentence is only read aloud once you
have checked your answer, so hearing it never gives the order away.

### XP and levels

Every card graded here earns XP toward your Wazn level, the same as in the web app: 3 for
*Again*, 10 for *Easy*, half that when practising. When you close the session the script
sends the session's total in one call (`add_xp` in the database) and the closing message
shows it, e.g. *+120 XP · Level 4*. If the session reached a new level it says so; the new
background and script can be picked straight from the widget (see below) or in the app's
Settings.

If the XP cannot be saved (no signal, or the database has not been set up with the two
migrations in `supabase/migrations/`), it is kept on the phone in the Keychain and sent
with the next session; the closing message says how much is waiting. Nothing is lost.

The session is sent with the phone's own date, so it counts toward that day's goal and your
streak in the app.

The widget also shows your level and how much XP is left to the next one.

The XP table, level thresholds, widget colours (`WIDGET_THEMES`, one row per background) and
scripts (`WIDGET_FONTS`, one row per card script) are copied from the app — keep them in
step; tests in `src/lib/levels.test.ts` check that they match.

### Font and background

What you unlock by levelling up shows on the widget too, and can be changed from it.

- **The background** is the app's own art, not a colour that hints at it. Each level
  background is rendered from the app's drawings at the three widget sizes
  (`scripts/widget-art/render.mjs`, into `public/widget/bg/`) and served with the site; the
  widget fetches the one it needs once and keeps it. A soft wash is baked in behind the
  word, the header and the level bar so text never fights a lantern or a dome.
- **The word** is drawn in the script your cards use. None of the level scripts ship with
  iOS, and a widget can only use installed fonts, so a hidden WebView loads the script from
  Google Fonts (only the glyphs of that word), draws it onto a canvas and hands back an
  image. The last drawing is kept, so a refresh with the same word costs nothing. If the
  script cannot be drawn — no signal on the very first refresh, say — the widget uses the
  nearest face iOS has (`ios` in `WIDGET_FONTS`) rather than showing nothing.
- **The review session** sets the cards in the same script.

**Changing them.** The picker lists every background (with its art) and every script (with
the word drawn in it), what is unlocked, and the level each locked one opens at. A preview
at the top shows the widget as it will look. It opens from:

- **Aa Style** in the bottom row of a **medium or large** widget, beside your level (a small
  widget has only one tap target, which belongs to the review);
- the **Aa** at the top of the review session, or **Change font & background** on its Done
  screen — tap either, and the picker opens when you swipe the session down;
- **Font & background** on the *All caught up* message.

Both choices are saved to your account (`set_background`, `set_card_font`), the same as
choosing them in the app's Settings — so the app follows a choice made on the phone, and
the widget follows one made in the app. The widget shows a change on its next refresh,
which iOS schedules.

To re-render the art after a background is added or redrawn:

```sh
node scripts/widget-art/render.mjs
```

then bump `BG_ART_VERSION` in `wazn-review.js` so phones fetch the new drawings instead of
keeping the cached ones.

### The front-loaded phase

A card that has just been learned doesn't go straight onto the SM-2 curve. For its first
five days it runs a fixed number of exposures — **four a day for three days, then two a day
for two more**, sixteen in all — spaced about three hours apart, and only then joins the
long-term rotation at a three-day interval. Cards already in the long-term rotation are not
affected: their schedules are exactly what they were.

Inside the phase the rating still moves the card's ease, so a word you keep failing carries
that difficulty out with it, but it doesn't change how many looks the card gets.

This means the widget needs two things beyond the date it always used:

- it asks for `next_review_at` as well as `next_review_date`, so a card graded five minutes
  ago isn't offered again straight away;
- it writes `intensive_day` and `intensive_reps_done` back with each grade, so a session on
  the phone advances the phase the same way a session in the browser does.

**If you ever change the scheduling logic in the web app, change it here too.** There is no
shared module between a TypeScript bundle and a Scriptable script, so this is a deliberate
duplication rather than an accidental one. `src/lib/widget-schedule.test.ts` guards it: it
lifts `advanceIntensive` straight out of this script, runs a card through all sixteen reps
with it, and fails if the two copies disagree.

## Notes

- Reads and writes go through Supabase's REST API using the same publishable anon key the
  web app ships to browsers. That key is not a secret; row-level security is what protects
  the data, and every request is authenticated as you.
- Only cards that have **graduated** and are **due today or earlier** appear — the same
  filter the web app's Review queue uses.
- The widget caches the last known due count, so it shows something sensible when offline
  rather than an error.
- If your password changes, the stored credentials are cleared automatically on the next
  failed sign-in and it will ask again.

---

## `wazn-podcasts.js` — browse podcasts (iOS)

A second, much smaller script in the same style: a widget that shows how many
podcasts exist, and a tap that opens a native list of all of them.

| Where | What it does |
|---|---|
| **Home-screen widget** | Shows the podcast count and the newest title. Tapping it opens the browse list. |
| **Run in Scriptable** | A native list (`UITable`), one row per podcast, its cover mark drawn on the fly, its total runtime shown. Tapping a row asks Shaami, Fuṣḥā, or both back to back, then opens that choice in Safari. |

### Why this doesn't play audio itself

Keeping a podcast going with the phone locked needs a page that registers with
the Media Session API and an `<audio>` element that is never torn down —
exactly what the web app's player already does, and what this session
verified works. Rebuilding that inside Scriptable would be a second, untested
copy of the one part of this app where "mostly works" is a real regression
from silence: a session that goes quiet the moment the phone locks is worse
than one that never claimed to keep playing.

So browsing and choosing stay native and fast — a `UITable`, no network wait
beyond the one list fetch — and the actual minute of listening is one tap into
`SITE_URL + "?podcast=<id>&register=<shaami|fusha|both>"`, which the web app
reads on load (see the deep-link effect near the top of `src/pages/Index.tsx`)
and opens straight to that podcast's player, register already chosen.

### Setup

1. Scriptable → **+** → paste the contents of `wazn-podcasts.js`.
2. Name it **Wazn Podcasts**.
3. Run it once. **If you already use `wazn-review.js` on this device, you're
   already signed in** — both scripts read the same Keychain entry
   (`wazn.email` / `wazn.password`), on purpose. If not, it asks once, the
   same way `wazn-review.js` does.
4. Long-press the home screen → **+** → **Scriptable** → pick a size.
5. Long-press the placed widget → **Edit Widget**:
   - **Script** → *Wazn Podcasts*
   - **When Interacting** → **Run Script**

### The cover mark

Drawn at runtime rather than loaded as an image: the same mihrab-and-arcs
geometry as the app's `mihrab` icon (`src/components/icons/WaznIcon.tsx`),
flattened once from curves into straight-line points (Scriptable's `Path` has
no arc primitive) and redrawn fresh at whatever size is asked for, so the
widget's small mark and the browse list's larger one are one drawing, not two
assets that could drift apart.

### If the table ever looks wrong

This script was written and logic-tested outside Scriptable — its control
flow, its deep-link URLs, and every `Color`/`Path`/`UITable` call were run
against a stand-in of Scriptable's API that checks argument types the same
way the real one would — but none of that is the same as running on a phone.
If a screen looks off, the file's structure mirrors `wazn-review.js` closely
enough that the same places are worth checking first: `buildWidget()` for the
widget, `runBrowsePodcasts()` for the list.

### Notes

- Same `SUPABASE_URL` / `SUPABASE_ANON_KEY` / row-level security model as
  `wazn-review.js` — see that script's notes above.
- The widget caches the last known count, same reasoning as the review
  widget's cache: something sensible offline beats an error.
- A podcast with neither file uploaded yet still shows up in the list, tapping
  it says so rather than opening a broken player.
