// أَحْمَر (red), composed as a flame: the alif is the right contour and the
// tip, the ر tail sweeps the base and climbs the left side to meet it, ح and
// م sit in the belly, and the hamza and marks float as counterweights.
// Glyphs (Amiri Bold): 0 ر · 1 fatha(م) · 2 م · 3 sukun(ح) · 4 ح ·
// 5 fatha(ا) · 6 ا (0 stroke, 1 hamza)
const K = require('../calligram.cjs');
const TIP = [640, 1800];
const flame = K.spline([[600, -300], [1010, -150], [1215, 260], [1170, 760], [960, 1240], TIP, [430, 1260], [80, 820], [-20, 300], [130, -140], [600, -300]], 30).pts;
const body = { type: 'rigid', s: 1.3, rot: 16, from: [305, 100], to: [320, 140] };
module.exports = {
  word: 'أَحْمَر', caption: 'red · a flame', font: 'amiri-bold', silhouette: flame, viewBox: '-300 -2000 1800 2450',
  place: [
    // ── ح and م, held as written and tilted so the word climbs toward the alif
    { glyph: 4, ...body },
    { glyph: 2, ...body },
    // ── ر: the elastic stroke — round the base and up the left side to the tip
    { glyph: 0, type: 'curve', src: [[305, 100], [292, 25], [262, -80], [216, -170], [150, -240], [70, -276], [-10, -276], [-78, -246]],
      dst: [[320, 140], [338, -10], [300, -140], [180, -230], [30, -180], [-60, 40], [-60, 380], [40, 760], [220, 1130], [420, 1430], [545, 1640]],
      s0: 1.3, w: 2.3, swellAt: 0.625, taper: 0.85, taperPow: 2.2, qmin: 0.5 },
    // ── ا: the right contour and the tip, with a foot that turns in to close the base
    { glyph: 6, subs: [0], type: 'curve', remap: 'linear', src: [[1203, 0], [1198, 250], [1192, 480], [1196, 700]],
      dst: [[640, -250], [950, -175], [1145, 80], [1200, 480], [1160, 900], [1010, 1330], TIP],
      s0: 2.2, w: 2.2, taper: 0.72, taperPow: 1.4, headTaper: 0.22, qmin: 0.6 },
    // ── the hamza and the marks, floated into the gaps, each above its own letter
    { glyph: 6, subs: [1], type: 'rigid', s: 1.65, rot: -10, to: [660, 1060] }, // hamza
    { glyph: 3, type: 'rigid', s: 1.05, to: [245, 880] },                       // sukun on ح
    { glyph: 1, type: 'rigid', s: 1.15, rot: 24, to: [275, 600] },              // fatha on م
    { glyph: 5, type: 'rigid', s: 1.15, rot: 32, to: [660, 1430] },             // fatha on ا
  ],
};
