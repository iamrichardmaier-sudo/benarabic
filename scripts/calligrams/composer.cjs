// Spec-driven calligram composer (see .claude/skills/arabic-calligram/SKILL.md).
// Each piece of the shaped word (a glyph, or one sub-shape of it such as a
// dot) is placed on its own by a rule:
//   rigid  — scale / rotate / move, for letters kept as written
//   curve  — mapped along a hand-placed skeleton, for elastic strokes
//   float  — a mark moved into a gap
const K = require('./calligram.cjs');

async function pieces(word, font) {
  const s = await K.shapeGlyphs(word, font);
  return s.glyphs.map((g) => K.flatten(g.path).map((sp) => sp.map(([x, y]) => [x + g.x, y + g.y])));
}
const center = (subs) => { const b = K.bbox(subs.flat()); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; };

function makeTransform(t, subs) {
  if (t.type === 'rigid') return K.rigid({ s: t.s ?? 1, rot: (t.rot ?? 0) * Math.PI / 180, from: t.from ?? center(subs), to: t.to });
  if (t.type === 'curve') {
    const src = K.withLength(t.src); const dst = K.spline(t.dst);
    const s0 = t.s0 ?? 1, w = t.w ?? 1, pen = t.pen ?? 35, qmin = t.qmin ?? 0.55;
    return K.alongCurve(src, dst, {
      // 'joined' (default): leave the start at the joined letter's scale, then
      // draw the stroke out — for a tail growing out of a rigid body.
      // 'linear': stretch evenly — for a free-standing stroke such as an alif.
      remap: t.remap === 'linear'
        ? (u, ls, ld) => (u / ls) * ld
        : (u, ls, ld) => { const f = u / ls; return s0 * u + (ld - s0 * ls) * f * f; },
      width: (v, T, len) => {
        const f = Math.min(1, Math.max(0, v / len));
        const swell = s0 + (w - s0) * Math.sin(Math.min(1, f / (t.swellAt ?? 0.4)) * Math.PI / 2);
        const tail = 1 - (t.taper ?? 0.85) * Math.pow(f, t.taperPow ?? 2.2);
        const head = t.headTaper ? 0.45 + 0.55 * Math.sin(Math.min(1, f / t.headTaper) * Math.PI / 2) : 1;
        return swell * tail * head * K.qalam(T, pen, qmin);
      },
    });
  }
  throw new Error('unknown transform ' + t.type);
}

/** spec.place: [{ glyph, subs?: [indices], ...transform }]; returns the composed path. */
async function compose(spec) {
  const glyphs = await pieces(spec.word, spec.font);
  const out = [];
  for (const p of spec.place) {
    const all = glyphs[p.glyph];
    const subs = p.subs ? p.subs.map((i) => all[i]) : all;
    const f = makeTransform(p, subs);
    for (const sp of subs) out.push(sp.map(f));
  }
  return out;
}
const toD = (polys) => polys.map((sp) => 'M' + sp.map(([x, y]) => `${x.toFixed(1)} ${(-y).toFixed(1)}`).join('L') + 'Z').join('');
module.exports = { compose, toD, pieces, K };
