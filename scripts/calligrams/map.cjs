// Map a word's glyphs before composing it: each glyph and sub-shape drawn in
// its own colour on a font-unit grid, with its index, bbox and area listed.
//   node map.cjs 'مَفْرُوشَات' [font]          -> out/map.png
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright'); const K = require('./calligram.cjs');
(async () => {
  const word = process.argv[2]; const font = process.argv[3] || 'amiri-bold';
  const s = await K.shapeGlyphs(word, font);
  const colors = ['#c0392b', '#2e86c1', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#b7950b', '#2c3e50', '#e84393', '#00b894', '#6c5ce7', '#fd79a8'];
  let shapes = '';
  s.glyphs.forEach((g, i) => {
    const subs = K.flatten(g.path).map((sp) => sp.map(([x, y]) => [x + g.x, y + g.y]));
    console.log(`#${i} cl${g.cl} gid${g.gid} x${g.x} ax${g.ax} :: ` + subs.map((sp, j) => `s${j}[${K.bbox(sp).map(Math.round)}] area ${Math.round(K.area(sp))}`).join('  '));
    shapes += `<path d="${g.path}" transform="translate(${g.x},${g.y})" fill="${colors[i % colors.length]}" fill-opacity=".75"/>`;
    const b = K.bbox(subs.flat()); shapes += `<text transform="scale(1,-1)" x="${(b[0] + b[2]) / 2}" y="${-b[3] - 20}" font-size="44" fill="${colors[i % colors.length]}">#${i}</text>`;
  });
  let grid = ''; for (let x = -400; x <= s.width + 200; x += 100) grid += `<line x1="${x}" x2="${x}" y1="-700" y2="1400" stroke="${x % 500 ? '#eee' : '#bbb'}" stroke-width="3"/>`;
  for (let y = -700; y <= 1400; y += 100) grid += `<line x1="-400" x2="${s.width + 200}" y1="${y}" y2="${y}" stroke="${y % 500 ? '#eee' : '#bbb'}" stroke-width="3"/>`;
  const W = s.width + 600, H = Math.round(1400 * 2100 / W);
  const html = `<html><body style="margin:0"><svg width="1400" height="${H}" viewBox="-400 -1400 ${W} 2100"><g transform="scale(1,-1)">${grid}${shapes}</g></svg></body></html>`;
  const outDir = path.join(__dirname, 'out'); fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1400, height: H } });
  await p.setContent(html); await p.screenshot({ path: path.join(outDir, 'map.png') }); await b.close();
})();
