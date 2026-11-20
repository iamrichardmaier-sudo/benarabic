# Training to compose Arabic calligrams — a handbook for the next model

You are picking up an apprenticeship that is a few weeks in. The goal: compose
real Arabic words as calligraphic emblems (calligrams), in the spirit of the
Al Jazeera logo, good enough to sit on the flashcards of an Arabic-learning app
(Wazn). This file holds everything learned so far: the rules that are not up
for debate, what the human judge said at each step, the numbers, every failure
and its fix, the worked studies, a graded curriculum, a scoring rubric, and
how to hand over when you stop.

It is written to be usable by any capable model with a shell, Node 18+ and a
headless Chromium (Playwright). Read it once end to end before your first
composition. When you finish a session, add to it (see *Handing over*).

Companion files, all in `scripts/calligrams/`:
- the tools (`*.cjs`, `setup.sh`), described in *Toolkit*;
- the three finished studies (`specs/`);
- the short working checklist used inside the app's repo:
  `.claude/skills/arabic-calligram/SKILL.md`.

---

## 1. Start here (the first thirty minutes)

```sh
cd scripts/calligrams
./setup.sh                                   # HarfBuzz shaper + 4 fonts into .cache/
node render.cjs specs/ahmar-flow.cjs         # -> out/ahmar-flow.png (guides | gilded)
node critique.cjs specs/ahmar-flow.cjs       # the automatic critic: should print PASS
node critique.cjs specs/ahmar.cjs            # an older study: FAIL — see why
node animate.cjs specs/ahmar.cjs specs/ahmar-flow.cjs specs/mafrushat.cjs   # out/gallery.html
```

Then open `out/ahmar-flow.png` and `out/gallery.html` (screenshot it with
Playwright if you cannot view HTML) and compare what you see with the worked
studies in section 13.
If your eye and the critic disagree, trust neither alone: zoom in with
`closeup.cjs` and find out why.

---

## 2. The non-negotiables

1. **The word must be the word.** Every stroke comes from a real font's
   outlines, shaped by HarfBuzz. Never let an image or video model draw Arabic
   letters: they invent or misspell them, and a learning app cannot show a
   misspelt word. (Image models may be used for backgrounds only, never for
   letters.)
2. **Never bend the whole word.** SVG `textPath` breaks Arabic joining.
   Warping the joined word as one piece (around a circle, a swirl) keeps the
   joins but reads as type in a ring, not calligraphy. Both were tried; the
   judge's verdict on the swirl was "you aren't even really close."
3. **Compose letter by letter**, the way a calligrapher does: each glyph, and
   each dot and haraka separately, is placed on its own — held as written, or
   drawn along a new skeleton. This is what got close ("that's actually much
   better").
4. **Keep the reading order traceable** right to left, and joins joined. A
   letter that joins its neighbour must still visibly join it.
5. **Every mark stays with its own letter.** A dot or haraka may move to the
   nearest open gap, but above stays above and below stays below. A fatha
   that drifts under the word reads as a kasra and changes the word
   (أَحْمَر → أَحْمِر). A hamza moved away from its alif reads as a ع.
6. **Fully vowel the input word** (أَحْمَر, not أحمر), so the harakat exist as
   glyphs you can place. Check the vowels against a dictionary; do not guess.

---

## 3. What the human judge said (calibration log)

The judge is the app's owner, a serious Arabic student. These are the
verdicts that set the direction, in order. Use them to calibrate your eye.

| # | What was shown | Verdict | What it taught |
|---|---|---|---|
| 1 | Request: "extreme Arabic calligraphy (think Al Jazeera)", animated | — | The target: an emblem, not a font sample |
| 2 | Whole word swirled in a circle (`textPath` / warp) | "you aren't even really close" | Never bend the word as a whole |
| 3 | Guidance given: semantic symbolism, structural inventory, negative space, "work individually with each letter … as though you are a calligrapher" | — | The method in section 4 |
| 4 | أحمر as a flame, letter by letter | "that's actually much better … you can get this" | Letter-by-letter is the right road |
| 5 | Next ask: a longer word, a different shape, "fill up the shape a little more", explore diacritics and fillers | — | Density and fillers matter; mafrushat study |
| 6 | Asked to read a master's Thuluth roundel (Surah al-Fatiha) back into its text | — | Reading masters is the best training (section 7) |
| 7 | Asked to read a free-style canvas (الحمد لله) | — | The *flowing* family; one line of movement |
| 8 | "now compose أحمر again using what you learned" | (shown; no objection) | The flowing أحمر: current best |

When you show work, show it gilded on a dark ground **and** at card sizes, and
say plainly what you think is still wrong. The judge notices; pretending a
piece is finished costs more than naming its flaw.

---

## 4. The method (follow in order)

1. **Choose the silhouette from the word.**
   - Meaning: literal (a falcon for صقر) or metaphor (a flame for أحمر "red";
     a carpet medallion for مفروشات "furnishings").
   - Letter inventory: words rich in ا ل ك (tall uprights) suit tall shapes —
     flame, teardrop, minaret, leaf. Words rich in و ر ن ق and bowls suit
     circles, crests, crescents. Baseline words with long kashida (س ص ب)
     suit shields, scrolls, hulls, banners.
   - Decide the **family** now (section 5): dense or flowing.
   - Draw the boundary and its axis before placing any letter. For a flowing
     piece, also draw the **line of movement** (`movement` in the spec) first.
2. **Inventory the word.** `node map.cjs '<word>'` prints every glyph and
   sub-shape with its index, bbox and area, and draws them in colour. Sort
   every piece into:
   - **anchors** — uprights (ا ل ك ط) that make spines and crests;
   - **counters** — closed loops (ف ق م و ة ه) that hold weight;
   - **elastic tails** — descenders and baselines (ي ر ز و ن, final bowls)
     that stretch along the contour;
   - **marks** — dots and harakat, placed last.
   Check the *joined* forms, not the dictionary forms: in ثلاجة the ج is
   initial and has no bowl, so the word has nothing to make a base with.
3. **Run spines and tails along the contour.** Tall strokes form the edges
   and the crest (Al Jazeera's alif and lam rise together into the tip). Tails
   sweep round the base and up a side.
4. **Interlock the core inside.** Middle letters sit in the interior, held
   rigid, enlarged and tilted so the word climbs. This is the knot.
5. **Balance the negative space, then place the marks.** Each mark over or
   under its own letter, clear of every stroke (the critic checks this), at
   one angle and one size per piece.
6. **Loop:** render → critique → close-up of the knot → change one or two
   things → again. Every word so far took three to seven passes. Write down
   each pass's change and why (section 11).

---

## 5. Measured targets

Measured on master works (section 7) and on our own studies with the tools
here. "Extent" is ink over the bounding box of the ink.

| | Dense (e.g. Thuluth roundel) | Flowing (e.g. free-style canvas) |
|---|---|---|
| Ink overall | 40–45% (critic accepts 35–50) | 10–20% of the extent |
| Ink in the knot | (texture everywhere) | 30–35% (critic accepts 28–40) |
| Where density comes from | many small marks at one angle and size; stacked tiers; letters nesting in each other's counters | one tight knot; everything else long, thin, tapering strokes |
| Marks | a woven texture in every gap | a few, each by its own letter |
| Rhythm | uprights parallel and evenly spaced; one or two long binders per cluster | one line of movement every long stroke rides; one gesture repeated as a parallel echo |
| Space | one deliberate channel; even texture elsewhere | open silhouette; long strokes *claim* space instead of filling it |
| Card sizes | holds as a gold emblem at 56 px | needs ≥ ~96 px; at 56 px strokes average under 3 px and read as hairlines |

Our current numbers (from `critique.cjs`):

| Study | Family | Extent | Knot | Avg stroke at 56 px | Critic |
|---|---|---|---|---|---|
| `ahmar` (flame) | dense | 27.8% — LOW | — | 3.3 px | FAIL: extent; sukun overlaps the ح 5% |
| `mafrushat` (medallion) | dense | 29.7% — LOW | — | 2.5 px | FAIL: extent; two marks touch letters |
| `ahmar-flow` | flowing | 15.0% | 35.8% | 2.9 px (weak) | PASS |

So: no dense composition has reached its target yet. That is the main open
problem (section 12).

---

## 6. Failure catalogue (symptom → cause → fix)

| Symptom | Cause | Fix |
|---|---|---|
| Letters disconnected or wrongly shaped | Text along a path; the shaper never saw the word | Shape with HarfBuzz first; place glyphs |
| Looks like type in a ring | The joined word warped as one piece | Compose letter by letter |
| A fatha reads as a kasra | Mark drifted under the word to fill a gap | Marks stay on their own side of their letter |
| A hamza reads as a ع | Hamza gathered with other marks away from its alif, above a sukun | Keep the hamza by its alif; never cluster marks away from their letters |
| The interior is a dark blob | Letters scaled up to "fill the shape" | Density from small marks and stacking, not heavier letters |
| Centre blob in مفروشات | In Amiri Bold the ش dots are taller than the ف | Split dots into separate gaps near their letters |
| A loop (و ف ق) squashed | Loop placed by a `curve`; it is extrapolated off the start of the tail | Place the loop `rigid`; only the tail runs along a curve |
| A mark merges with a stroke | Not visible at full-panel size | `closeup.cjs` on the knot; `critique.cjs` flags touching marks |
| A tail crosses another letter (ر into و) | Skeleton drawn without the neighbours | Move the anchor, re-route the tail around the counter |
| One side of the silhouette empty | Strokes not running the contour | Extend a tail or an upright's foot along that side |
| Composition wanders, no direction | Strokes placed one by one with no shared line | Draw `movement` first; bend every long stroke along it |
| Shape feels unfinished but filling it looks heavy | Trying to *close* the outline | Close by pointing: two tapering tips aimed at each other across a gap |
| Strokes look like a felt pen | Constant width | `qalam()` broad-nib contrast; taper both ends; swell in the first third |
| Emblem vanishes on a 56 px card | Tall flowing piece scaled by its width; thin strokes | Use the dense family or a heavier variant for list sizes |
| NaN coordinates | `Math.pow` of a negative fraction past the curve's end | Clamp the fraction to [0, 1] (already done in `composer.cjs`) |
| Stroke mirrored to the wrong side of its skeleton | Normal sign convention mismatch | `alongCurve` uses `p + N·n·w` with the left normal, same as `project()` |

---

## 7. Reading masters (the best training available)

Pick a master work whose text you know or can look up. Read it back into its
text, word by word:

1. Enlarge it region by region (a Playwright screenshot of a scaled `<img>`
   at 3–4×; `crop` it so each region fills the frame).
2. Find the words you can read with **certainty** first. Then place the rest
   by the order of the text. Say which are certain and which are placed.
3. Record, for the piece: the layout (what is biggest, where); the reading
   path; how words stack; the rhythm (uprights, binders); how marks are used;
   where the white space is; and **measure** the ink density (pure-black
   pixels in a region over its area).
4. Write down what to take into your next composition.

Two readings so far:

**Surah al-Fatiha, Thuluth jali roundel** — dense.
- Verse 2 (الحمد لله رب العالمين) in the centre, largest: hierarchy by scale.
- The ring reads in two arcs, both from 3 o'clock to 9: over the top with
  letters radial (upright to the outside), along the bottom flipped upright
  for the reader so nothing is upside down.
- Words stacked in two or three tiers; letters nest in each other's counters;
  nothing sits on one baseline.
- A palisade of parallel, evenly spaced uprights, all at one slant.
- A few long binders (the ب of رب, the bowls of العالمين) tie each cluster.
- Hundreds of harakat (fatha, kasra, shadda as a small "w", dagger alif,
  sukun) at **one angle and one size** (about a sixth of letter height) read
  as a woven texture.
- One clear channel between centre and ring.
- Measured ink: about 45% in the centre, 39% in the ring.

**الْحَمْدُ لِلَّهِ, a free-style canvas** — flowing.
- The alif and lam of «الـ» are two nested arcs on one curve, rising from the
  knot and tapering to hairlines: they *are* the crest.
- «حمد» folds into one tight knot; «لله» stands as three evenly spaced
  uprights.
- One long S-shaped swash makes the left edge and the base.
- One line of movement: crest tip → knot → swash → base. Nothing fights it.
- Only a few harakat, in one small group.
- The silhouette is open; the background holds the rest.
- Measured ink: about 33% in the knot, 10–20% overall.

Good next readings: a Diwani or Diwani jali piece (dense, rounded, marks as
ornament), a square Kufic composition (geometry, no marks at all), and a
modern logo built from one word (Al Jazeera itself, Aramco's or a ministry's).

---

## 8. Toolkit

Everything works in **font units, y up** (Amiri's em is 1000). SVG output
flips y.

| Command | Does |
|---|---|
| `./setup.sh` | Installs `harfbuzzjs@0.4.6` into `.cache/` and downloads Amiri Bold, Aref Ruqaa, Rakkas and Reem Kufi |
| `node map.cjs '<word>' [font]` | Glyph map: each glyph and sub-shape in colour on a grid; prints index, bbox, area → `out/map.png` |
| `node zoom-glyph.cjs '<word>' <i> x0 y0 x1 y1` | One glyph on a 50-unit grid, to read skeleton points off it → `out/zoom.png` |
| `node render.cjs specs/x.cjs` | Guides (skeletons red, silhouette grey, movement orange, knot blue) beside the gilded result; prints ink figures → `out/x.png` |
| `node closeup.cjs specs/x.cjs "x y w h" [px]` | One region at full size, ink only → `out/closeup.png` |
| `node critique.cjs specs/x.cjs` | The automatic critic (below); exit code 1 on failure |
| `node animate.cjs specs/a.cjs …` | Animated gallery: the pen writes, the gold fills, a light sweeps; at full and card sizes → `out/gallery.html` |

### The spec

```js
module.exports = {
  word: 'أَحْمَر',            // fully voweled
  font: 'amiri-bold',         // or a .ttf path
  caption: 'red · a flame',
  family: 'flowing',          // 'dense' | 'flowing' (critic targets)
  viewBox: '-110 -2290 1575 3150',      // SVG units (y down)
  movement: [[x, y], …],      // optional: the line of movement
  knot: [x0, y0, x1, y1],     // optional: the knot and its marks
  silhouette: [[x, y], …],    // closed outline, for the coverage figure
  place: [ /* one entry per piece, see below */ ],
};
```

Placements:

```js
{ glyph: 2, type: 'rigid', s: 1.4, rot: 10, from: [480, 215], to: [500, 500] }
  // held as written: scale, rotate (degrees) about `from`, moved to `to`.
  // `from` defaults to the piece's centre — right for marks.
{ glyph: 6, subs: [1], role: 'mark', type: 'rigid', s: 0.9, to: [800, 1920] }
  // subs picks sub-shapes by index from the map (a dot, a hamza);
  // role: 'mark' tells the critic this piece must float clear of letters.
{ glyph: 4, type: 'curve', src: [[480,215], …], dst: [[500,500], …],
  s0: 1.4, w: 1.45, swellAt: 0.35, taper: 0.93, taperPow: 1.5, qmin: 0.5 }
  // drawn along a new skeleton. src: points along the stroke's spine in the
  // shaped word (read off map/zoom-glyph); dst: Catmull-Rom points of the
  // new path. s0 = width at the start (match the joined body's scale so the
  // join is seamless); w = width at the swell; swellAt = where (0–1);
  // taper/taperPow = thinning to the end; headTaper = thinning at the start;
  // pen = nib angle (default 35°); qmin = thinnest across the nib (0.45–0.6);
  // remap: 'linear' for a free stroke such as an alif (default keeps the
  // start at the body's scale and draws the rest out).
```

A letter's counter is its own sub-shape and must move with its body. Dots are
separate sub-shapes and may float.

### The critic (`critique.cjs`)

Checks what the judge kept catching by eye:
- **density** against the family's targets (extent always; knot when given);
- **marks**: every `role: 'mark'` piece must not overlap or touch a letter;
- **frame**: no ink cut off by the viewBox;
- **small sizes**: the average stroke width at 56 and 96 px wide (under 3 px
  reads as hairlines).

It writes `out/<name>-56.png` and `-96.png`. A PASS is necessary, not
sufficient: the critic cannot tell whether the word reads, whether the
movement flows, or whether the shape means anything. Those are section 10.

---

## 9. Curriculum

Work through the levels in order. A level is passed when two compositions in
it each score at least 16/24 on the rubric (section 10), pass the critic, and
read correctly to a reader who has not been told the word. When you have no
Arabic reader to hand, at minimum render the piece at 96 px without its
caption and check your own first reading.

The word suggestions are untested: inventory each one (`map.cjs`) before
committing to a shape, and swap it if the joined forms do not support it.

**Level 1 — one gesture, flowing.** A short word with one tall letter and one
tail. Reproduce the flowing أحمر's structure on a new word.
- Suggestions: نَهْر (river: a wave), بَحْر (sea: a wave), أَمَل (hope: a rising
  flame), فَجْر (dawn: a sun over a horizon).
- Must have: a line of movement every long stroke rides; one knot; marks by
  their letters.

**Level 2 — the echo.** A word with two uprights that can rise as nested
arcs (the canvas's alif-lam).
- Suggestions: الْقَلْب (the heart), الْأَمَل (hope), الْكِتاب (the book).
- Must have: two parallel crest strokes of one gesture, tapering to hairlines.

**Level 3 — dense, reach the target.** The open problem. A word with several
bowls and dots.
- Suggestions: صَداقَة (friendship: a medallion), مُخْتَلِف (different: a
  mirrored shield), شَمْس (sun: a roundel).
- Must have: extent ≥ 35% from small marks at one angle and size, stacking
  and nesting — not from heavier letters. Try the muhmal signs and the
  Quranic sukun (section 12) as fillers.

**Level 4 — the same word in both families.** Pick one word; compose a dense
version for 56 px cards and a flowing one for the card face. Show them side
by side at 56, 96 and 300 px.

**Level 5 — two words.** A short phrase (أَهْلاً وَسَهْلاً, شُكْراً جَزيلاً) in tiers,
reading down then left, with one long binder, as in the Fatiha roundel.

**Level 6 — a rule-based first draft.** Write a generator that takes a word
and produces a spec: inventory → family → silhouette → default placements
(anchors to the contour, counters to the knot, tails along the movement,
marks over their letters). Score its drafts on ten words; hand-tune the best
three. This is the road to an emblem on every card.

Alongside every level: read one master work (section 7) and record it here.

---

## 10. Rubric (score each 0–3; pass at 16 of 24, with no 0 anywhere)

| Criterion | 0 | 1 | 2 | 3 |
|---|---|---|---|---|
| **Spelling and marks** | a letter or mark wrong or missing | marks ambiguous (could read as another haraka or letter) | correct but a mark crowds its neighbour | every letter and mark correct, clear, by its letter |
| **Legibility** | cannot be read | readable once told the word | readable with effort | reads at first glance at 96 px |
| **Reading order and joins** | order lost or a join broken | traceable with difficulty | traceable | the eye follows it naturally |
| **Silhouette and meaning** | no shape | a shape unrelated to the word | a fitting shape, loosely held | the shape says the word |
| **Movement and rhythm** | strokes fight each other | a direction, not held | one line, mostly held | one line every long stroke rides; an echo or palisade |
| **Density and space** | blob or scatter | far off the family's target | near the target | on target; space gathered deliberately |
| **Craft of the strokes** | constant width, kinks | some contrast | broad-nib contrast, tapers | strokes look written: swell, taper, clean joins |
| **Card sizes** | gone at 96 px | readable only at full size | an emblem at 96 px | an emblem at 56 px |

The three finished studies, self-scored by the model that made them (the
judge has not scored them): `ahmar` ~15 (dense below
target; a mark overlap), `mafrushat` ~14 (crowded centre; dense below
target), `ahmar-flow` ~18 (best so far; weak at 56 px).

---

## 11. Handing over

At the end of every session:

1. Commit the new specs (`specs/<word>.cjs`) and any tool changes.
2. Add a **study entry** to section 13, in this form:

   ```
   **<word> — <meaning>, as <shape>** (`specs/<file>.cjs`, <family>,
   extent N%, knot N%, avg stroke at 56 px N px, rubric N/24)
   Silhouette and why. Anatomy: which letter does what.
   Passes: (1) what was wrong → (2) what changed → …
   Lessons: one line each, phrased as a rule the next model can apply.
   ```
3. Add any new failure to the catalogue (section 6) and any new measurement
   to the targets (section 5).
4. Record the judge's verdicts in section 3, word for word where possible.
5. Update section 12: what is now solved, what is newly open.

Rules for writing it: say what was measured and what was guessed; never
report a pass the critic or the judge did not give; keep the reasons, not
only the settings.

---

## 12. Open problems

- **Dense density.** No dense piece has reached 35–45%. Next: many small
  marks at one angle and size in every gap, and stacking. Fillers available
  and untried: the *muhmal* signs (a small "v" over undotted ر س ص ط د, a tiny
  ح under ح, a tiny ع under ع, drawn from the font's own glyphs scaled down),
  the Quranic small high rounded zero / sukun shaped like a small ح head
  (U+06E1), shadda and tanwin where the word has them.
- **Flow in a dense piece.** Binders should ride a line of movement too; not
  yet tried.
- **Small sizes.** The flowing family thins to under 3 px strokes at 56 px.
  Try a heavier variant (w and s0 up ~30%, qmin up), or pair the emblem with
  the printed word in lists.
- **Loop distortion along curves.** Place loops rigid; only tails curve.
- **Fonts.** Everything so far is Amiri Bold (Naskh). Aref Ruqaa, Rakkas and
  Reem Kufi are installed and unexplored: a Ruqaa or Kufic emblem may suit
  some words better, and their joins differ.
- **Scaling to every card.** Level 6: a rule-based first draft with
  hand-tuned favourites.
- **Animation.** The current animation strokes the outline and fills it. A
  truer one would draw each stroke along its skeleton in writing order, with
  marks added last, as a calligrapher writes.

---

## 13. Worked studies

**أَحْمَر — red, as a flame** (`specs/ahmar.cjs`; extent 27.8%; avg stroke at
56 px 3.3 px). The alif runs up the right edge into the tip, its foot turning
in to close the base; the ر tail sweeps the base and climbs the left side to
meet it at the crest; ح and م sit in the belly, enlarged ×1.3 and tilted 16°
so the word climbs toward the alif. Passes: (1) thin, lopsided, open lower
right → (2) body tilted, ر run to the crest → (3) alif foot closes the base →
(4) heavier strokes → (5) marks fill gaps but too heavy, and a fatha under
the word read as a kasra → (6–7) lighter marks, each above its letter. The
critic, added later, still finds the sukun overlapping the ح by 5%.
Lessons: a filled flame sits between the families and hits neither target;
check marks at full size.

**مَفْرُوشَات — furnishings, as a carpet medallion** (`specs/mafrushat.cjs`;
extent 29.7%; 2.5 px at 56 px). Three tiers right to left: مف at upper right;
the ر tail resting above the ش teeth; و on the left rim, its tail running down
to the cradle; the ا rising from the ش as the spine; the isolated ت bowl
stretched along three quarters of the rim as a cradle. Passes: (1) the ر
crossed the alif into the و, right side empty → (2) alif moved left, ت arm up
the right rim → (3) centre a blob: the ش dots are taller than the ف in Amiri
Bold → (4) dots split into the cradle, marks in one column → (5) letters
larger → (6) و separated from the alif. Lessons: a long final bowl makes a
cradle; dots are movable weight; read glyph sizes off the map, not from
memory.

**أَحْمَر — red, flowing** (`specs/ahmar-flow.cjs`; flowing; extent 15.0%;
knot 35.8%; 2.9 px at 56 px; critic PASS) — the same word after reading the
الحمد لله canvas. The alif is the outer crest arc; the ح's head bar is drawn
out inside it as a parallel echo, so the crest is two strokes of one gesture;
ح's head and the م (×1.4) are the knot; the ر's tail runs down the left and
back along the base, its tip pointing at the alif's in-turned foot, so the
flame is implied rather than closed. Passes: (1) the marks gathered as one
cluster beside the knot (copying the canvas) — the hamza, far from its alif
and above a sukun, read as a ع → (2) every mark back over its own letter,
smaller; alif foot turned in; ر swash curled along the base → (3) a fatha
merged with the ح's head and a sukun touching its bar, visible only in a
close-up: lifted clear; knot ×1.25 → ×1.4 and tendrils lighter so the weight
sits in the knot. Lessons: "marks in one cluster" yields to "each mark by its
letter"; any stroke leaving the knot in the crest's direction can be the
echo; close a shape by pointing, not touching.

---

## Appendix: where it goes in the app

Cards have one empty art slot, `src/components/CardArt.tsx`, placed on every
screen that shows a card (review, learn, focus review, deck list) with the
size it has room for. A finished emblem is an SVG path (`out/<name>.d.txt`)
in the spec's viewBox; render it there in the card's gold.
