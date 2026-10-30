// Zoom on one glyph with a 50-unit grid, to read skeleton points off it.
//   node zoom-glyph.cjs <word> <glyph index> x0 y0 x1 y1   -> out/zoom.png
const path = require('path'); const fs = require('fs');
const { chromium } = require('playwright'); const K = require('./calligram.cjs');
(async () => {
  const [word, gi, x0, y0, x1, y1] = process.argv.slice(2); const s = await K.shapeGlyphs(word, 'amiri-bold');
  const g = s.glyphs[Number(gi)]; const others = s.glyphs.filter((_, i) => i !== Number(gi));
  let grid = ''; for (let x = +x0; x <= +x1; x += 50) grid += `<line x1="${x}" x2="${x}" y1="${y0}" y2="${y1}" stroke="${x % 100 ? '#eee' : '#bbb'}" stroke-width="2"/><text transform="scale(1,-1)" x="${x + 3}" y="${-y0 - 8}" font-size="18" fill="#999">${x % 100 ? '' : x}</text>`;
  for (let y = +y0; y <= +y1; y += 50) grid += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="${y % 100 ? '#eee' : '#bbb'}" stroke-width="2"/><text transform="scale(1,-1)" x="${+x0 + 3}" y="${-y - 4}" font-size="18" fill="#999">${y % 100 ? '' : y}</text>`;
  const W = x1 - x0, H = y1 - y0;
  const html = `<html><body style="margin:0"><svg width="900" height="${Math.round(900 * H / W)}" viewBox="${x0} ${-y1} ${W} ${H}"><g transform="scale(1,-1)">${grid}
  ${others.map((o) => `<path d="${o.path}" transform="translate(${o.x},${o.y})" fill="#ccc" fill-opacity=".5"/>`).join('')}
  <path d="${g.path}" transform="translate(${g.x},${g.y})" fill="#27ae60" fill-opacity=".8"/></g></svg></body></html>`;
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 900, height: Math.round(900 * H / W) } });
  await p.setContent(html); await p.screenshot({ path: path.join(__dirname, 'out', 'zoom.png') }); await b.close();
})();
