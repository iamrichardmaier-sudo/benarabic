// أَحْمَر (red), second composition: the *flowing* family, after the الحمد لله
// canvas. One line of movement is drawn first; the crest is two nested arcs —
// the alif outside, the ح's head bar drawn out inside it as an echo; ح's head
// and the م make one dense knot; the ر's tail is the long swash down the left
// and back along the base, its tip pointing at the alif's in-turned foot, so
// the flame is implied rather than closed. Each mark stays over its own letter.
// Passes and lessons: SKILL.md, *Word studies*.
// Glyphs (Amiri Bold): 0 ر · 1 fatha(م) · 2 م · 3 sukun(ح) · 4 ح ·
// 5 fatha(ا) · 6 ا (0 stroke, 1 hamza)
const K = [500, 500];           // where the knot sits: the ح/م join
const KS = 1.4;                 // the knot's scale
const at = ([x, y]) => [K[0] + (x - 480) * KS, K[1] + (y - 215) * KS]; // word → composition, for the knot
module.exports = {
  word: 'أَحْمَر', caption: 'red · a flame, flowing', font: 'amiri-bold', viewBox: '-110 -2290 1575 3150',
  // the line of movement: the crest's tip, down through the knot, down the swash and back along the base
  movement: [[960, 2060], [1230, 1450], [1150, 900], [700, 520], [250, 300], [60, -200], [150, -560], [450, -700], [800, -500]],
  // the knot with its marks, for its density (flowing family: aim ~30–35%)
  knot: [120, 180, 860, 920],
  // a loose outline of what the strokes claim, for the coverage figure
  silhouette: [[960, 2100], [1330, 1300], [1300, 600], [1050, 150], [850, -420], [600, -720], [250, -700], [20, -420], [10, 0], [200, 420], [600, 760], [850, 1600], [960, 2100]],
  place: [
    // ── the knot: م held as written; ح's hook stays with it, its bar becomes the inner arc
    { glyph: 2, type: 'rigid', s: KS, from: [480, 215], to: K },
    { glyph: 4, type: 'curve', src: [[480, 215], [560, 235], [640, 255], [720, 265], [800, 262], [880, 250], [960, 242], [1010, 250]],
      dst: [K, at([560, 235]), at([640, 255]), at([720, 268]), [930, 640], [1040, 820], [1095, 1040], [1085, 1290], [1010, 1520], [900, 1700]],
      s0: KS, w: 1.45, swellAt: 0.35, taper: 0.93, taperPow: 1.5, qmin: 0.5 },
    // ── the alif: the outer arc, the same curve one stroke further out, rising to the tip
    { glyph: 6, subs: [0], type: 'curve', remap: 'linear', src: [[1203, 0], [1198, 250], [1192, 480], [1196, 700]],
      dst: [[860, 60], [1000, 170], [1130, 380], [1250, 680], [1300, 1000], [1280, 1310], [1190, 1610], [1070, 1860], [960, 2060]],
      s0: 1.85, w: 1.85, taper: 0.9, taperPow: 1.5, headTaper: 0.12, qmin: 0.55 },
    // ── the ر: its tail is the swash — down and left, then turning back right at the base
    { glyph: 0, type: 'curve', src: [[305, 100], [292, 25], [262, -80], [216, -170], [150, -240], [70, -276], [-10, -276], [-78, -246]],
      dst: [at([305, 100]), [235, 200], [160, 60], [75, -150], [80, -380], [190, -570], [400, -680], [640, -650], [830, -500]],
      s0: KS, w: 1.65, swellAt: 0.45, taper: 0.92, taperPow: 2, qmin: 0.5 },
    // ── the marks, each over its own letter: hamza and fatha by the alif's tip,
    //    sukun and fatha just above the knot — small, at one angle
    { glyph: 6, subs: [1], type: 'rigid', s: 0.9, rot: -8, to: [800, 1920] },  // hamza on ا
    { glyph: 5, type: 'rigid', s: 0.85, rot: 10, to: [850, 2080] },            // fatha on أ
    { glyph: 3, type: 'rigid', s: 0.8, to: [770, 860] },                       // sukun on ح
    { glyph: 1, type: 'rigid', s: 0.85, rot: 10, to: [380, 800] },             // fatha on م
  ],
};
