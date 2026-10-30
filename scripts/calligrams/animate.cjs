// Animated gallery of composed calligrams: the pen writes the outline, the
// gold ink fills in, then the mark floats with a light sweeping across. Each
// is shown large and at card sizes; it holds still for reduced motion.
//   node animate.cjs specs/ahmar.cjs specs/mafrushat.cjs   -> out/gallery.html
const path = require('path'); const fs = require('fs');
const { compose, toD } = require('./composer.cjs');
const GROUNDS = ['radial-gradient(circle at 50% 42%,#1b4064,#07131e 75%)', 'radial-gradient(circle at 50% 45%,#0f5149,#04201c 75%)', 'radial-gradient(circle at 50% 45%,#4a1d2e,#16070d 75%)'];
(async () => {
  const pieces = [];
  for (const [i, file] of process.argv.slice(2).entries()) {
    const spec = require(path.resolve(file));
    const [, , vw, vh] = spec.viewBox.split(' ').map(Number);
    pieces.push({ d: toD(await compose(spec)), vb: spec.viewBox, ratio: vh / vw, ar: spec.word, en: spec.caption || '', bg: GROUNDS[i % GROUNDS.length] });
  }
  const tile = (p, size, id) => `
<div class="tile" style="width:${size}px;height:${Math.round(size * p.ratio)}px;background:${p.bg}">
<svg viewBox="${p.vb}" width="100%" height="100%" aria-hidden="true">
  <defs>
    <linearGradient id="gold${id}" x1="0" y1="0" x2="0.35" y2="1"><stop offset="0" stop-color="#fff1bf"/><stop offset=".45" stop-color="#e2b740"/><stop offset="1" stop-color="#a87a14"/></linearGradient>
    <linearGradient id="shine${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="word${id}"><path d="${p.d}"/></clipPath>
  </defs>
  <g class="float">
    <path class="ink" d="${p.d}" fill="url(#gold${id})"/>
    <path class="pen" d="${p.d}" fill="none" stroke="#f3d37a" stroke-width="12" pathLength="1"/>
    <g clip-path="url(#word${id})"><rect class="shine" x="-2600" y="-2200" width="600" height="3000" fill="url(#shine${id})" transform="skewX(-18)"/></g>
  </g>
</svg></div>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Calligrams</title><style>
  body{margin:0;min-height:100vh;background:#f6f1e9;font-family:system-ui,sans-serif;color:#2b2118;display:flex;flex-direction:column;align-items:center;gap:28px;padding:28px 16px}
  .row{display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap;justify-content:center}
  figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:8px}
  figcaption{font-size:13px;opacity:.7;text-align:center}figcaption b{font-size:20px;opacity:1;display:block;font-weight:600}
  .tile{border-radius:28px;box-shadow:0 10px 30px rgba(0,0,0,.25);padding:3%;box-sizing:border-box}
  .pen{stroke-dasharray:1;stroke-dashoffset:1;animation:write 2.4s ease-in-out forwards, penout .6s 2.3s forwards}
  .ink{opacity:0;animation:fill 1.1s 1.5s ease-out forwards}
  .float{transform-box:fill-box;transform-origin:50% 60%;animation:rise 4.4s 2.6s ease-in-out infinite}
  .shine{animation:shine 5.5s 3s ease-in-out infinite}
  @keyframes write{to{stroke-dashoffset:0}} @keyframes penout{to{opacity:0}} @keyframes fill{to{opacity:1}}
  @keyframes rise{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-24px) scale(1.012)}}
  @keyframes shine{0%{transform:skewX(-18deg) translateX(0)}45%,100%{transform:skewX(-18deg) translateX(4800px)}}
  @media (prefers-reduced-motion:reduce){.pen{display:none}.ink{opacity:1;animation:none}.float,.shine{animation:none}}
  </style></head><body>
  <div class="row">${pieces.map((p, i) => `<figure>${tile(p, 300, 'L' + i)}<figcaption><b lang="ar" dir="rtl">${p.ar}</b>${p.en}</figcaption></figure>`).join('')}</div>
  <div class="row">${pieces.map((p, i) => tile(p, 96, 'M' + i) + tile(p, 56, 'S' + i)).join('')}</div>
  </body></html>`;
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'gallery.html'), html);
  console.log('wrote out/gallery.html');
})();
