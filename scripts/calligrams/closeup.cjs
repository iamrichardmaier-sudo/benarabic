// Close-up of one region of a composed spec, ink only, black on white — for
// judging joins, the knot and the marks at full size.
//   node closeup.cjs specs/ahmar-flow.cjs "x y w h" [width px]   -> out/closeup.png
// The region is in SVG units (y down): the spec's viewBox, cut smaller.
const path = require('path');
const { chromium } = require('playwright');
const { compose, toD } = require('./composer.cjs');
(async () => {
  const [file, vb, px = 700] = process.argv.slice(2);
  const spec = require(path.resolve(file));
  const d = toD(await compose(spec));
  const [vx, vy, vw, vh] = (vb || spec.viewBox).split(' ').map(Number);
  const W = Number(px), H = Math.round(W * vh / vw);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(`<body style="margin:0"><svg width="${W}" height="${H}" viewBox="${vx} ${vy} ${vw} ${vh}" style="background:#fff"><path d="${d}" fill="#111"/></svg></body>`);
  await p.screenshot({ path: path.join(__dirname, 'out', 'closeup.png') }); await b.close();
})();
