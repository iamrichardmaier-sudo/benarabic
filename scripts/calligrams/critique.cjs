// The automatic critic: the checks a human judge kept catching by eye, run on
// a spec so the next pass starts from numbers instead of a hunch.
//   node critique.cjs specs/ahmar-flow.cjs        -> report on stdout,
//                                                   out/<name>-56.png, -96.png
// Checks
//   density   ink of the silhouette, of the ink's own extent, and of `knot`,
//             against the family's targets (spec.family: 'dense' | 'flowing')
//   marks     every mark that touches or swallows a letter (a mark is a
//             placement with role: 'mark', or a small rigid one — under 6% of
//             the extent's area); a mark must float clear of the letters
//   frame     ink cut off by the viewBox
//   small     the average stroke width at card sizes (56 and 96 px wide);
//             under ~3 px a piece reads as hairlines (informative, not a fail;
//             calibrated on two pieces: 2.9 px looked thin, 3.3 px held)
// Exit code 1 when a check fails, so it can gate a loop.
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright');
const { composeParts, toD, K } = require('./composer.cjs');

const TARGETS = { dense: { extent: [35, 50], knot: [38, 50] }, flowing: { extent: [10, 20], knot: [28, 40] } };

(async () => {
  const file = process.argv[2];
  const spec = require(path.resolve(file));
  const name = path.basename(file, '.cjs');
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  const parts = await composeParts(spec);
  const [vx, vy, vw, vh] = spec.viewBox.split(' ').map(Number);
  const all = parts.flatMap((p) => p.polys.flat());
  const ext = K.bbox(all); const extArea = (ext[2] - ext[0]) * (ext[3] - ext[1]);
  // Marks are labelled in the spec (role: 'mark'). A spec with no labels at all
  // falls back to a guess: a small rigid placement, under 6% of the extent.
  const labelled = parts.some((p) => p.place.role);
  const isMark = (p) => (labelled ? p.place.role === 'mark' : p.place.type === 'rigid' && (() => { const b = K.bbox(p.polys.flat()); return (b[2] - b[0]) * (b[3] - b[1]) < 0.06 * extArea; })());
  const labels = parts.map((p, i) => `#${i} glyph ${p.place.glyph}${p.place.subs ? ` sub ${p.place.subs}` : ''}`);
  const data = {
    vb: [vx, vy, vw, vh], sil: spec.silhouette || null, knot: spec.knot || null,
    parts: parts.map((p) => ({ d: toD(p.polys), mark: isMark(p) })), all: toD(parts.flatMap((p) => p.polys)),
  };
  const b = await chromium.launch(); const page = await b.newPage();
  const r = await page.evaluate((D) => {
    const W = 800, sc = W / D.vb[2], H = Math.round(D.vb[3] * sc);
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'); x.setTransform(sc, 0, 0, sc, -D.vb[0] * sc, -D.vb[1] * sc); return x; };
    const alpha = (x) => { const d = x.getImageData(0, 0, W, H).data; const a = new Uint8Array(W * H); for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3] > 128 ? 1 : 0; return a; };
    const fill = (d) => { const x = mk(); x.fill(new Path2D(d)); return alpha(x); };
    const ink = fill(D.all);
    let n = 0, x0 = W, y0 = H, x1 = -1, y1 = -1, edge = 0;
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) if (ink[y * W + X]) { n++; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, y); y1 = Math.max(y1, y); if (X === 0 || y === 0 || X === W - 1 || y === H - 1) edge++; }
    const out = { extent: 100 * n / ((x1 - x0 + 1) * (y1 - y0 + 1)), edge };
    if (D.sil) { const x = mk(); x.fill(new Path2D('M' + D.sil.map(([a, b]) => a + ' ' + (-b)).join('L') + 'Z')); const s = alpha(x); let A = 0, I = 0; for (let i = 0; i < s.length; i++) if (s[i]) { A++; I += ink[i]; } out.silhouette = 100 * I / A; }
    if (D.knot) { const [a, bb, c, d] = D.knot; const px = (u) => Math.round((u - D.vb[0]) * sc), py = (v) => Math.round((-v - D.vb[1]) * sc); let k = 0, KK = 0; for (let y = py(d); y < py(bb); y++) for (let X = px(a); X < px(c); X++) { KK++; k += ink[y * W + X] || 0; } out.knot = 100 * k / KK; }
    // marks against letters: overlap, and contact within a small clearance
    const letters = fill(D.parts.filter((p) => !p.mark).map((p) => p.d).join(''));
    const gap = Math.max(2, Math.round(W * 0.006));
    out.marks = D.parts.map((p, i) => {
      if (!p.mark) return null;
      const m = fill(p.d); let over = 0, near = 0, size = 0;
      for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { if (!m[y * W + X]) continue; size++; if (letters[y * W + X]) over++;
        else for (let dy = -gap; dy <= gap && !near; dy += gap) for (let dx = -gap; dx <= gap; dx += gap) { const yy = y + dy, xx = X + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W && letters[yy * W + xx]) { near = 1; break; } } }
      return { i, over: size ? 100 * over / size : 0, touches: over > 0 || near > 0 };
    }).filter(Boolean);
    // small sizes: what kills a calligram on a card is stroke width, not lost
    // tips — a tall piece shrunk to 56 px wide draws every stroke thin. The
    // average stroke width is about twice the ink's area over its outline.
    let perim = 0;
    for (let y = 0; y < H; y++) for (let X = 0; X < W; X++) { if (!ink[y * W + X]) continue;
      if (!X || !y || X === W - 1 || y === H - 1 || !ink[y * W + X - 1] || !ink[y * W + X + 1] || !ink[(y - 1) * W + X] || !ink[(y + 1) * W + X]) perim++; }
    const stroke = 2 * n / Math.max(1, perim);
    out.small = [56, 96].map((w) => {
      const s2 = w / D.vb[2], h = Math.round(D.vb[3] * s2); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.setTransform(s2, 0, 0, s2, -D.vb[0] * s2, -D.vb[1] * s2); x.fill(new Path2D(D.all));
      return { w, h, stroke: stroke * w / W, png: c.toDataURL('image/png') };
    });
    return out;
  }, data);
  for (const s of r.small) fs.writeFileSync(path.join(outDir, `${name}-${s.w}.png`), Buffer.from(s.png.split(',')[1], 'base64'));
  await b.close();

  const fam = spec.family || (r.knot != null ? 'flowing' : 'dense'); const T = TARGETS[fam];
  const fails = [];
  const range = (v, [lo, hi]) => (v >= lo && v <= hi ? 'ok' : v < lo ? `LOW (target ${lo}–${hi})` : `HIGH (target ${lo}–${hi})`);
  console.log(`${name} — ${fam} family`);
  console.log(`  extent  ${r.extent.toFixed(1)}%  ${range(r.extent, T.extent)}`); if (range(r.extent, T.extent) !== 'ok') fails.push('extent');
  if (r.knot != null) { console.log(`  knot    ${r.knot.toFixed(1)}%  ${range(r.knot, T.knot)}`); if (range(r.knot, T.knot) !== 'ok') fails.push('knot'); }
  if (r.silhouette != null) console.log(`  silhouette ${r.silhouette.toFixed(1)}% (informative)`);
  console.log(`  frame   ${r.edge ? `CUT — ${r.edge} px of ink on the edge of the viewBox` : 'ok'}`); if (r.edge) fails.push('frame');
  for (const m of r.marks) { const bad = m.over > 0 ? `SWALLOWED ${m.over.toFixed(0)}% inside a letter` : m.touches ? 'TOUCHES a letter' : 'clear'; console.log(`  mark ${labels[m.i]}  ${bad}`); if (bad !== 'clear') fails.push('mark'); }
  for (const s of r.small) console.log(`  at ${s.w}×${s.h}px  average stroke ${s.stroke.toFixed(1)} px${s.stroke < 3 ? '  WEAK — reads as hairlines at this size; use a heavier variant' : ''}  -> out/${name}-${s.w}.png`);
  console.log(fails.length ? `FAIL: ${[...new Set(fails)].join(', ')}` : 'PASS');
  process.exitCode = fails.length ? 1 : 0;
})();
