// Shape a word with HarfBuzz and return each glyph's outline and position,
// so every letter (and every dot and mark) can be placed on its own.
const fs = require('fs');
const path = require('path');
const CACHE = path.join(__dirname, '.cache');

let hbPromise = null;
function harfbuzz() {
  if (!hbPromise) {
    try {
      hbPromise = require(path.join(CACHE, 'node_modules/harfbuzzjs'));
    } catch {
      throw new Error('Run scripts/calligrams/setup.sh first (installs the shaper and fonts).');
    }
  }
  return hbPromise;
}

/** A font by name ("amiri-bold") or by path. */
const fontPath = (font) => (font.endsWith('.ttf') ? font : path.join(CACHE, 'fonts', `${font}.ttf`));

module.exports.shapeGlyphs = async function shapeGlyphs(word, font, features) {
  const hb = await harfbuzz();
  const blob = hb.createBlob(fs.readFileSync(fontPath(font)));
  const face = hb.createFace(blob, 0);
  const f = hb.createFont(face);
  const buf = hb.createBuffer();
  buf.addText(word);
  buf.guessSegmentProperties();
  hb.shape(f, buf, features);
  const out = [];
  let pen = 0;
  for (const g of buf.json()) {
    out.push({ gid: g.g, cl: g.cl, x: pen + g.dx, y: g.dy, ax: g.ax, path: f.glyphToPath(g.g) });
    pen += g.ax;
  }
  buf.destroy();
  return { glyphs: out, width: pen, upem: face.upem };
};
