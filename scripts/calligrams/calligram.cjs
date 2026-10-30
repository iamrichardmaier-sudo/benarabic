// A calligram composed letter by letter: each glyph of the shaped word is
// placed on its own — rigidly, or mapped along a hand-placed skeleton curve —
// inside a silhouette chosen for the word.
const { shapeGlyphs } = require('./shape.cjs');

// ---------- geometry helpers
function flatten(d, step = 6) { // SVG path -> subpaths of dense points
  const t = d.match(/[MLQCZ]|-?[\d.]+(?:e-?\d+)?/gi); const out = []; let cur = null, x = 0, y = 0, i = 0;
  const num = () => parseFloat(t[i++]);
  const lineTo = (nx, ny) => { const n = Math.max(1, Math.ceil(Math.hypot(nx - x, ny - y) / step)); for (let s = 1; s <= n; s++) cur.push([x + (nx - x) * s / n, y + (ny - y) * s / n]); x = nx; y = ny; };
  while (i < t.length) { const c = t[i++];
    if (c === 'M') { x = num(); y = num(); cur = [[x, y]]; out.push(cur); }
    else if (c === 'L') lineTo(num(), num());
    else if (c === 'Q') { const x1 = num(), y1 = num(), x2 = num(), y2 = num(); const n = 16; const sx = x, sy = y; for (let s = 1; s <= n; s++) { const u = s / n, a = (1 - u) ** 2, b = 2 * (1 - u) * u, e = u * u; cur.push([a * sx + b * x1 + e * x2, a * sy + b * y1 + e * y2]); } x = x2; y = y2; }
    else if (c === 'C') { const x1 = num(), y1 = num(), x2 = num(), y2 = num(), x3 = num(), y3 = num(); const n = 20; const sx = x, sy = y; for (let s = 1; s <= n; s++) { const u = s / n, a = (1 - u) ** 3, b = 3 * (1 - u) ** 2 * u, e = 3 * (1 - u) * u * u, f = u ** 3; cur.push([a * sx + b * x1 + e * x2 + f * x3, a * sy + b * y1 + e * y2 + f * y3]); } x = x3; y = y3; }
  }
  return out;
}
const area = (sp) => { let a = 0; for (let i = 0; i < sp.length; i++) { const [x1, y1] = sp[i], [x2, y2] = sp[(i + 1) % sp.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a / 2); };
const bbox = (sp) => sp.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);

/** Catmull-Rom through points -> dense polyline with arc length. */
function spline(pts, per = 40) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < per; s++) { const u = s / per, u2 = u * u, u3 = u2 * u;
      out.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3))); }
  }
  out.push(pts[pts.length - 1]);
  return withLength(out);
}
function withLength(pts) { const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, L, len: L[L.length - 1] }; }
function at(c, v) { // point + unit tangent at arc length v (extrapolated past the ends)
  const { pts, L, len } = c;
  if (v <= 0 || v >= len) { const [a, b] = v <= 0 ? [pts[0], pts[1]] : [pts[pts.length - 2], pts[pts.length - 1]]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); const T = [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; const o = v <= 0 ? pts[0] : pts[pts.length - 1]; const e = v <= 0 ? v : v - len; return { p: [o[0] + T[0] * e, o[1] + T[1] * e], T }; }
  let lo = 0, hi = L.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= v) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi], f = (v - L[lo]) / (L[hi] - L[lo] || 1); const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return { p: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], T: [(b[0] - a[0]) / d, (b[1] - a[1]) / d] };
}
function project(c, p) { // arc length u and signed normal offset n of p against curve c
  const { pts, L } = c; let best = { d: Infinity };
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], ll = dx * dx + dy * dy || 1;
    let f = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / ll;
    if (i > 0) f = Math.max(0, f); if (i < pts.length - 2) f = Math.min(1, f); // extrapolate only at the ends
    const q = [a[0] + dx * f, a[1] + dy * f], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
    if (d < best.d) { const len = Math.sqrt(ll); const n = ((p[1] - a[1]) * dx - (p[0] - a[0]) * dy) / len; best = { d, u: L[i] + f * len, n }; }
  }
  return best;
}

/**
 * Map a stroke from its source skeleton onto a target skeleton.
 * remap(u) gives target arc length for source arc length; width(v, T) the
 * scale across the stroke at target arc length v with tangent T.
 */
function alongCurve(src, dst, { remap, width }) {
  return ([x, y]) => {
    const { u, n } = project(src, [x, y]);
    const v = remap(u, src.len, dst.len);
    const { p, T } = at(dst, v);
    const N = [-T[1], T[0]]; // left normal, same convention as project()
    const w = width(v, T, dst.len);
    return [p[0] + N[0] * n * w, p[1] + N[1] * n * w];
  };
}
const rigid = ({ s = 1, rot = 0, from, to }) => { const c = Math.cos(rot), si = Math.sin(rot); return ([x, y]) => { const dx = (x - from[0]) * s, dy = (y - from[1]) * s; return [to[0] + dx * c - dy * si, to[1] + dx * si + dy * c]; }; };

/** Broad-nib contrast: thick across the nib's edge, thin along it. */
const qalam = (T, pen = 35, min = 0.45) => { const ang = Math.atan2(T[1], T[0]); return min + (1 - min) * Math.abs(Math.sin(ang - pen * Math.PI / 180)); };

module.exports = { flatten, area, bbox, spline, withLength, at, project, alongCurve, rigid, qalam, shapeGlyphs };
