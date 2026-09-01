# Wazn — Scriptable widget & review session (iOS)

`wazn-review.js` is a single file that behaves two ways depending on where it runs.

| Where | What it does |
|---|---|
| **Home-screen widget** | Shows how many cards are due and the next word in Arabic. Tapping it launches the review session. |
| **Run in Scriptable** | A full-screen review session: tap the middle to flip, then the **left** third for *Again* and the **right** third for *Easy*. Words are read aloud, and the answer side shows the same word detail as the web app. |

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
- **Tap the left third** — *Again* (resets to a 1-day interval).
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

**If you ever change the scheduling logic in the web app, change it here too.** There is no
shared module between a TypeScript bundle and a Scriptable script, so this is a deliberate
duplication rather than an accidental one.

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
