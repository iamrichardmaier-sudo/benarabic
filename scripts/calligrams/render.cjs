// Render a spec: guides on white beside the gilded result, and measure how
// much of the silhouette the ink covers.
//   node render.cjs specs/ahmar.cjs            -> out/ahmar.png, out/ahmar.d.txt
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright');
const { compose, toD, K } = require('./composer.cjs');

(async () => {
  const file = process.argv[2];
  const spec = require(path.resolve(file));
  const name = path.basename(file, '.cjs');
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  const d = toD(await compose(spec));
  const [vx, vy, vw, vh] = spec.viewBox.split(' ').map(Number);
  const W = 440, H = Math.round(W * vh / vw);
  const line = (pts, c, w = 6, dash = '') => `<polyline points="${pts.map(([x, y]) => `${x},${-y}`).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ''}/>`;
  const guides = spec.place.filter((p) => p.type === 'curve').map((p) => line(K.spline(p.dst).pts, '#c0392b', 5)).join('')
    // The line of movement, drawn first: every long stroke should ride it.
    + (spec.movement ? line(K.spline(spec.movement).pts, '#e67e22', 14, '40 26') : '')
    + (spec.knot ? `<rect x="${spec.knot[0]}" y="${-spec.knot[3]}" width="${spec.knot[2] - spec.knot[0]}" height="${spec.knot[3] - spec.knot[1]}" fill="none" stroke="#2980b9" stroke-width="6" stroke-dasharray="20 14"/>` : '');
  const html = `<html><body style="margin:0;display:flex;gap:16px;padding:16px;background:#eee">
  <svg width="${W}" height="${H}" viewBox="${spec.viewBox}" style="background:#fff">${line(spec.silhouette, '#bbb', 8, '30 20')}${guides}<path d="${d}" fill="#222" fill-opacity=".8"/></svg>
  <svg width="${W}" height="${H}" viewBox="${spec.viewBox}" style="background:radial-gradient(circle at 50% 45%, #183a57, #08141f)"><defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#fff1bf"/><stop offset=".45" stop-color="#e2b740"/><stop offset="1" stop-color="#a87a14"/></linearGradient></defs><path d="${d}" fill="url(#g)"/></svg></body></html>`;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 2 * W + 48, height: H + 32 } });
  await p.setContent(html); await p.screenshot({ path: path.join(outDir, `${name}.png`) });
  const sc = 600 / vw; const CH = Math.round(vh * sc);
  const cover = await p.evaluate(({ d, sil, vx, vy, sc, CH, kb }) => {
    const c = document.createElement('canvas'); c.width = 600; c.height = CH; const x = c.getContext('2d');
    const tf = () => x.setTransform(sc, 0, 0, sc, -vx * sc, -vy * sc);
    tf(); x.fill(new Path2D('M' + sil.map(([a, b]) => a + ' ' + (-b)).join('L') + 'Z')); const A0 = x.getImageData(0, 0, 600, CH).data;
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, 600, CH); tf(); x.fill(new Path2D(d)); const I0 = x.getImageData(0, 0, 600, CH).data;
    let A = 0, I = 0, out = 0; for (let i = 3; i < I0.length; i += 4) { if (A0[i] > 128) { A++; if (I0[i] > 128) I++; } else if (I0[i] > 128) out++; }
    // The flowing family is judged by its knot and by the ink of its whole
    // extent (the box round the ink), as measured on the الحمد لله canvas.
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    for (let y = 0; y < CH; y++) for (let X = 0; X < 600; X++) if (I0[(y * 600 + X) * 4 + 3] > 128) { n++; x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    let knot = null;
    if (kb) {
      const [a, b] = [Math.round((kb[0] - vx) * sc), Math.round((-kb[3] - vy) * sc)], [c2, d2] = [Math.round((kb[2] - vx) * sc), Math.round((-kb[1] - vy) * sc)];
      let k = 0, KK = 0; for (let y = b; y < d2; y++) for (let X = a; X < c2; X++) { KK++; if (I0[(y * 600 + X) * 4 + 3] > 128) k++; }
      knot = (100 * k / KK).toFixed(1);
    }
    return { ink: (100 * I / A).toFixed(1), outside: out, extent: (100 * n / ((x1 - x0 + 1) * (y1 - y0 + 1))).toFixed(1), knot };
  }, { d, sil: spec.silhouette, vx, vy, sc, CH, kb: spec.knot ?? null });
  console.log(`${name}: ink covers ${cover.ink}% of the silhouette; ${cover.outside} px of ink outside it`);
  console.log(`  ${cover.extent}% of its extent${cover.knot ? `; the knot ${cover.knot}%` : ''}`);
  fs.writeFileSync(path.join(outDir, `${name}.d.txt`), d);
  await b.close();
})();
