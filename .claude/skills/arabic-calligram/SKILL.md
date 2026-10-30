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
   - First decide the family (see *Master studies*): **dense** (texture
     everywhere, like a Thuluth roundel: aim ~40–45% ink) or **flowing** (one
     knot with long tendrils, like a free-style canvas: knot ~30–35%,
     composition ~10–20%, and one clear line of movement). Measured so far in
     our own work: ~30% — see *Open problems*.
   - Fill with many small marks at one angle and one size, not with bigger
     letters: that reads as texture, where heavier letters read as blobs.
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

## Master studies (reading the work of others)

Reading a master's composition back into its text, word by word, is the best
training available: it shows where each word was put and why. Enlarge the
image region by region (Playwright screenshot of a scaled `<img>`, 3–4×),
find the words you can read with certainty first, then place the rest by the
order of the text — and say which is which.

**Surah al-Fatiha, Thuluth jali roundel** (read on 2026-10-30).
- **Layout.** A central block holds verse 2, الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ, in the
  largest letters; a ring carries the rest of the surah around it, smaller.
  Hierarchy by scale: the verse that matters most is biggest and in the middle.
- **The ring reads in two arcs.** Over the top, letters stand upright *to the
  outside* (radial), read from 3 o'clock across the top to 9 o'clock: the
  basmala/الرحمن الرحيم, مالك يوم الدين, إياك نعبد وإياك نستعين, اهدنا الصراط
  المستقيم. Along the bottom the letters are flipped upright *for the reader*
  so nothing is upside down, and that arc reads again from 3 o'clock to 9:
  صراط الذين، أنعمت عليهم، غير المغضوب عليهم، ولا الضالين. Read for certain:
  verse 2, إياك نعبد وإياك نستعين, صراط الذين أنعمت عليهم, غير المغضوب عليهم;
  the rest was placed by the surah's order.
- **Stacking.** Words are written in two or three overlapping tiers; inside a
  cluster the eye reads down, then on to the left. Letters nest into each
  other's counters; nothing is laid out on a single baseline.
- **A palisade of uprights.** Alifs and lams stand parallel, evenly spaced, at
  one slant — in the centre vertical, in the ring all pointing at the centre.
  That rhythm is most of what makes it look like calligraphy.
- **Long binders.** A few long horizontals — the ب of رب, the ن/ي bowls of
  العالمين, the ك of إياك — sweep under or across a cluster and tie it together;
  in the ring they follow the curve.
- **Marks as texture.** Hundreds of small harakat — fathas, kasras, shaddas
  written as a small "w", dagger alifs (ٰ), sukuns — all cut at *one* angle and
  one size (about a sixth of letter height). Laid evenly in every gap they read
  as a woven texture rather than as clutter. This, not bigger letters, is
  where the density comes from.
- **Whitespace is gathered, not scattered.** A clear channel separates the
  centre from the ring; inside each region the texture is even.
- **Density, measured.** Pure-black ink covers about 45% of the centre and
  about 39% of the ring (a slight undercount: the image carries a coloured
  guide grid). So a master's piece sits near **40–45% ink**, not 55–65%.

What to take into the next composition: (1) one angle and one size for every
mark, used generously in every gap; (2) uprights parallel and evenly spaced;
(3) stack words in tiers and let letters nest; (4) one or two long binders per
cluster; (5) leave one deliberate channel of space, keep the rest even.

**الْحَمْدُ لِلَّهِ — a free, flowing piece on canvas** (read on 2026-10-30). Black
ink on a canvas split between white and gold leaf, with a gold arabesque down
one side. Read for certain: the whole phrase.
- **Anatomy.** The alif and lam of «الـ» are two nested arcs on one curve,
  rising from the knot and tapering to hairlines — they *are* the flame crest
  (the same idea as Al Jazeera's alif-lam). «حمد» folds ح (a broad wedge), م
  and د into one tight knot. «لله» stands as three evenly spaced uprights
  beside it. One long S-shaped swash, carried down from the word, makes the
  left edge and the base.
- **One line of movement.** The whole word follows a single S from the tip of
  the crest, through the knot, down the swash to the base. Every long stroke
  rides that line; nothing fights it.
- **Knot and tendrils.** All the weight sits in one dense knot, a little above
  the middle and off-centre; everything else is a few long, thin, tapering
  strokes reaching out from it. Ink is ~33% in the knot but only ~10–20% of the
  composition as a whole — and it looks complete, because the long strokes
  claim the space instead of filling it.
- **Parallel echoes.** The two crest arcs repeat one curve, offset — the
  rhythm comes from repetition of a single gesture, not from many marks.
- **Marks as one cluster.** Only a few harakat (shadda with dagger alif,
  fatha, damma), gathered in one small group in the gap between the crest and
  the uprights — a counterweight, not a texture.
- **Open silhouette.** The shape isn't enclosed: crest and swash define two
  sides, and the background (the white/gold split and the arabesque) holds the
  rest.

**Two families, two density targets.** The Fatiha roundel is a *dense*
composition: texture everywhere, ~40–45% ink. This piece is a *flowing* one: a
dense knot (~30–35%) with long tendrils and open space, ~10–20% overall. Decide
which family a word is going into before measuring anything. Our أحمر flame is
really the flowing kind — its ~30% is fine, and it would gain more from a
second nested crest stroke and one clear S-line than from extra marks.

**For card art:** the flowing family is likely the better fit. One bold
gesture and a knot survive at 48–56 px; a dense texture turns to grey.

## Open problems

- **Density, by family.** Both of our studies sit near 30% ink. For a dense
  composition the target is ~40–45% (the Fatiha roundel), reached with many
  small marks at one angle and size plus stacking — not heavier letters, which
  turned interiors into blobs. For a flowing composition (the الحمد لله canvas)
  ~30% in the knot is already right; work on the line of movement instead.
- **Flow.** Our compositions place letters well but don't yet move along one
  line. Next: draw the line of movement first (as a guide in the spec), and
  bend the long strokes along it; try doubling a crest stroke as a parallel
  echo.
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
