// مَفْرُوشَات (furnishings), composed as a round carpet medallion (shamsa).
// Six passes; the notes for each are in the skill (Word studies).
// Glyphs (Amiri Bold): 0 ت (0 bowl, 1 dots) · 1 ا · 2 fatha(ش) · 3 ش (0 teeth,
// 1-2 dots) · 4 و · 5 damma(ر) · 6 ر · 7 sukun(ف) · 8 ف (0-1 body, 2 dot) ·
// 9 fatha(م) · 10 م
const R = 1000;
const circle = Array.from({ length: 181 }, (_, i) => [R * Math.cos(i * 2 * Math.PI / 180), R * Math.sin(i * 2 * Math.PI / 180)]);
module.exports = {
  word: 'مَفْرُوشَات', caption: 'furnishings · a carpet medallion', font: 'amiri-bold', silhouette: circle, viewBox: '-1100 -1100 2200 2200',
  place: [
    // ── ش, held as written; the alif grows out of its join
    { glyph: 3, subs: [0], type: 'rigid', s: 1.1, from: [1150, 12], to: [-260, -380] },
    // ── ا: the spine, left of centre, leaning in toward the top
    { glyph: 1, type: 'curve', src: [[1150, 12], [1085, 40], [1052, 130], [1040, 330], [1028, 530], [1000, 735]],
      dst: [[-260, -380], [-325, -350], [-358, -260], [-365, 40], [-345, 420], [-290, 900]], s0: 1.1, w: 1.8, taper: 0.55, swellAt: 0.3 },
    // ── مف: the loops, right of middle
    { glyph: 10, type: 'rigid', s: 0.95, from: [2428, 100], to: [130, 200] },
    { glyph: 8, subs: [0, 1], type: 'rigid', s: 0.95, from: [2428, 100], to: [130, 200] },
    // ── ر: its tail rests above the ش teeth and rises toward the alif
    { glyph: 6, type: 'curve', src: [[2428, 100], [2415, 25], [2385, -80], [2339, -170], [2273, -240], [2193, -276], [2113, -276], [2045, -246]],
      dst: [[130, 200], [120, 105], [75, 30], [-10, -8], [-120, -5], [-215, 40]], s0: 0.95, w: 1.8 },
    // ── و: a heavier loop at the top left, its tail down the left rim
    { glyph: 4, type: 'curve', src: [[1935, 198], [1976, 50], [1930, -40], [1860, -130], [1760, -185], [1650, -175]],
      dst: [[-690, 500], [-680, 330], [-740, 170], [-830, 0], [-890, -180], [-895, -340]], s0: 1.5, w: 2.0 },
    // ── ت: the bowl wraps three quarters of the way round, rising up the right rim
    { glyph: 0, subs: [0], type: 'curve', src: [[790, 380], [830, 240], [800, 140], [700, 60], [500, 15], [300, 15], [150, 60], [80, 150], [110, 300], [160, 360]],
      dst: [[830, 10], [890, -170], [820, -420], [600, -680], [300, -830], [0, -860], [-330, -790], [-600, -630], [-740, -450], [-790, -310], [-770, -210]],
      s0: 1.1, w: 1.6, taper: 0.5, taperPow: 6, headTaper: 0.08 },
    // ── dots and marks, each floated above (or in) its own letter
    { glyph: 0, subs: [1], type: 'rigid', s: 1.2, to: [-450, -540], rot: -20 }, // ت dots, the empty left of the cradle
    { glyph: 8, subs: [2], type: 'rigid', s: 1.25, to: [300, 560] },      // ف dot
    { glyph: 3, subs: [1, 2], type: 'rigid', s: 1.05, to: [540, -250] },  // ش dots, in the open space beside it
    { glyph: 9, type: 'rigid', s: 1.2, to: [660, 560], rot: 8 },          // fatha on م
    { glyph: 7, type: 'rigid', s: 1.15, to: [300, 790] },                 // sukun on ف
    { glyph: 5, type: 'rigid', s: 1.15, to: [-90, 200] },                 // damma on ر, just above its tail
    { glyph: 2, type: 'rigid', s: 1.2, to: [-100, 640], rot: 16 },        // fatha on ش, top of the column
  ],
};
