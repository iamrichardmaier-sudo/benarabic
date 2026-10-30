---
name: arabic-calligram
description: Compose an Arabic word as a calligraphic emblem (a calligram), in the spirit of the Al Jazeera logo — the real, correctly spelled word, its letters placed one by one inside a silhouette chosen for its meaning, then gilded and animated. Use when asked to draw, compose or animate Arabic calligraphy, calligrams, word emblems or card art for Wazn, or to continue building this skill.
---

# Arabic calligrams, letter by letter

This is a skill still being learned. Two words are done (see **Word studies**);
the goal is emblems good enough to put on every flashcard. Read this whole
file before composing, and add what you learn to it when you finish.

## Why it works this way

- **Never let an image model draw the letters.** Generators invent Arabic or
  misspell it, and a learning app cannot show a misspelt word. Every stroke
  here comes from a real font's outlines, shaped by HarfBuzz, so the word is
  always the word.
- **Never bend the word as a whole.** Text along a path (SVG `textPath`) breaks
  Arabic joining; warping the joined word around a circle as one piece keeps
  the joins but reads as typography in a ring, not calligraphy. Both were tried
  and rejected.
- **Compose letter by letter, as a calligrapher does.** Each glyph — and each
  dot and mark separately — is placed on its own: held as written, or drawn
  along a new skeleton. That is what got close.

## The method (follow in order)

1. **Choose the silhouette first, from the word.**
   - Meaning: literal (a falcon for صقر) or metaphor (Al Jazeera's flame).
     أحمر (red) → a flame; مفروشات (furnishings) → a carpet medallion.
   - Letter inventory: words rich in ا ل ك (tall verticals) suit tall shapes —
     flame, teardrop, minaret, leaf. Words rich in و ر ن ق and bowls suit
     circles, crests, crescents. Baseline-bound words with kashida (س ص ب)
     suit shields, scrolls, boat hulls, banners.
   - Draw the boundary and its axis before placing any letter.
2. **Inventory the word.** Run `node scripts/calligrams/map.cjs '<word>'` and
   sort every piece into:
   - **anchors** — ascenders (ا ل ك) that make spines;
   - **counters** — closed loops (ف ق م و ة) that hold weight;
   - **elastic tails** — descenders and baselines (ي ر ز و ن, isolated ت/ب
     bowls) that stretch and curve to hug the boundary;
   - **marks** — dots and harakat, kept back to plug gaps at the end.
   Check the *joined* forms: in ثلاجة the ج is initial and has no bowl, so the
   word has nothing to make a base with. Pick another word, or another shape.
3. **Run spines and terminals along the contour.** Tall strokes form the
   edges and the crest (Al Jazeera's alif-lam rise together into the tip);
   tails sweep round the base and up a side.
4. **Interlock the core inside.** Middle letters sit in the interior, held
   rigid (`rigid`), enlarged and tilted so the word climbs. Keep the reading
   order traceable right to left.
5. **Balance the negative space, then float the marks.**
   - Aim for the shape to look full but legible (guidance: 35–45% empty).
     Measured so far: ~30% ink — see *Open problems*.
   - Each dot and haraka moves to the nearest open gap, but stays above or
     below its own letter as written: a fatha drifting under the word reads as
     a kasra and changes the word (أحمر → أحمِر).
   - Marks are lighter than letters: scale ~1.05–1.2, and line each one up
     with the strokes beside it.

## The tools (`scripts/calligrams/`)

```sh
scripts/calligrams/setup.sh                       # once: shaper + fonts into .cache/
node scripts/calligrams/map.cjs 'مَفْرُوشَات'      # glyph map -> out/map.png (+ indices, bboxes)
node scripts/calligrams/render.cjs specs/x.cjs    # guides + gilded result -> out/x.png, ink coverage %
node scripts/calligrams/animate.cjs specs/a.cjs specs/b.cjs   # animated gallery -> out/gallery.html
```

A composition is a **spec** (`specs/*.cjs`): the word (fully voweled, so the
harakat exist as glyphs), the font, the silhouette, a viewBox, and one
placement per piece. Work in font units, y up.

```js
{ glyph: 3, subs: [0], type: 'rigid', s: 1.1, rot: 16, from: [x, y], to: [x, y] }
  // held as written: scale, rotate (degrees) about `from`, moved to `to`.
  // `from` defaults to the piece's centre — right for floated marks.
{ glyph: 6, type: 'curve', src: [...], dst: [...], s0, w, ... }
  // drawn along a new skeleton. src: points along the stroke's spine in the
  // shaped word (read them off the map); dst: Catmull-Rom points of the new
  // path. Options: s0 width at the start (= the joined body's scale, so the
  // join stays seamless), w width at the swell, swellAt, taper/taperPow (end),
  // headTaper (start), pen (nib angle, default 35°), qmin (thinnest, 0.45–0.6),
  // remap: 'linear' for a free stroke such as an alif.
```

`subs` picks sub-shapes of a glyph by index from the map: a letter's counter is
its own sub-shape and must move with its body; dots are separate sub-shapes and
can float. Stroke width follows a broad nib (`qalam()`): thick across the nib,
thin along it.

**The loop:** map → write a spec → render → look hard at both panels and the
coverage number → change one or two things → render again. Each word took six
or seven passes. Keep the white panel's guides honest: the red lines are the
skeletons, the dashed line is the silhouette.

## Calligraphers' fillers to reach for

Used so far: fully voweled harakat (fatha, damma, sukun) stacked in a column
above their letters, Thuluth-style; dots split between gaps near their letters
(the ت's dots on one side of a bowl, the ش's on the other); a free-floating
hamza as a counterweight; kashida (`curve` tails) to stretch a stroke along the
contour.

Not yet tried, available for the next words: the *muhmal* signs — a small "v"
over undotted letters (ر س ص ط د), a tiny ح under ح, a tiny ع under ع (draw them
from the font's own glyphs, scaled down); the Quranic sukun shaped like a small
ح head (U+06E1); shadda and tanwin where the word has them. Overlap loops
lightly (they may touch, never swallow each other).

## Word studies

**أَحْمَر — red, as a flame** (`specs/ahmar.cjs`, ~30% ink). The alif runs up
the right edge into the tip, with a foot that turns in to close the base; the ر
tail sweeps the base and climbs the left side to meet it at the crest; ح and م
sit in the belly, enlarged ×1.3 and tilted 16° so the word climbs toward the
alif. Passes: (1) thin, lopsided, open lower right → (2) tilt the body, run
the ر to the crest → (3) alif foot closes the base → (4) heavier strokes →
(5) marks fill gaps but too heavy, and a fatha under the word read as kasra →
(6–7) lighter marks, each above its letter.

**مَفْرُوشَات — furnishings, as a carpet medallion** (`specs/mafrushat.cjs`,
~32% ink). Three tiers right to left: مف at upper right; the ر tail resting
above the ش teeth; و on the left rim, its tail running down to meet the cradle;
the ا rising from the ش as the spine; the isolated ت bowl stretched along three
quarters of the rim as a cradle. Passes: (1) ر crossed the alif into the و,
right side empty → (2) alif moved left, ت arm up the right rim → (3) centre a
blob — the ش dots are taller than the ف in Amiri Bold → (4) dots split into the
cradle, marks in one column → (5) letters larger → (6) و separated from the
alif.

## Open problems

- **Density.** Both studies sit near 30% ink against a 55–65% target. Pushing
  further turned interiors into blobs. Try: more interlocking of loops, the
  muhmal signs and small letters above, a second weight of strokes.
- **Small sizes.** At 48–56 px a calligram is a recognisable gold emblem, not
  a readable word. For card lists, consider pairing it with the printed word.
- **Loop distortion.** A loop placed by a `curve` (the و) is extrapolated off
  the start of its tail and gets squashed. Place loops `rigid` and let only the
  tail run along a curve.
- **Scaling to every card.** Each word is composed by hand today. A rule-based
  first draft (inventory → silhouette → default placements) with hand-tuned
  favourites is the likely path.

## Where it goes in the app

Cards have one empty art slot, `src/components/CardArt.tsx`, already placed on
every screen that shows a card (review, learn, focus review, deck list) with
the size it has room for. To show calligrams, render them there.
