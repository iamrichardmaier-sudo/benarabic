# Wazn — Scriptable widget & review session (iOS)

`wazn-review.js` is a single file that behaves two ways depending on where it runs.

| Where | What it does |
|---|---|
| **Home-screen widget** | Shows how many cards are due and the next word in Arabic. Tapping it launches the review session. |
| **Run in Scriptable** | A full-screen review session: tap the middle to flip, then the **left** third for *Again* and the **right** third for *Easy*. |

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

   To save typing your address every time you re-paste the script, set `DEFAULT_EMAIL`
   near the top of *your* copy in Scriptable:

   ```js
   const DEFAULT_EMAIL = "you@example.com";
   ```

   It is left blank in this repository on purpose — **this repo is public**, so an address
   committed here would be scraped from the file and from git history permanently. Your
   Scriptable copy lives on your device and is never pushed anywhere, which is the right
   place for it. Never put the password in the file: after the first run the Keychain
   already has it, and a password in a script is one screenshot away from being shared.
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
- **Swipe down** to finish. Everything graded up to that point is saved, so a session you
  abandon halfway still counts.

*Hard* and *Good* aren't offered here by design — a two-choice pass is what makes a
phone-sized session fast. Use the web app when you want the full four-way rating.

## How it stays in sync with the web app

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
