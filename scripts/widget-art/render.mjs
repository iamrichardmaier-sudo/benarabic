/**
 * Renders every level background at the three iOS widget sizes, into
 * public/widget/bg/<id>-<small|medium|large>.jpg, for the Scriptable widget.
 *
 *   node scripts/widget-art/render.mjs
 *
 * Re-run it when a background is added or redrawn. JPEG rather than PNG: the
 * art is opaque, the files are a fraction of the size, and the PWA precaches
 * PNGs but not JPEGs, so these never bloat the app's offline cache — only the
 * widget ever asks for them.
 */
import { createServer } from 'vite';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Playwright is not a dependency of the app; it is used from wherever it is
// installed globally, which require() resolves and a bare ESM import does not.
const { chromium } = createRequire(import.meta.url)('playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const out = path.join(repo, 'public/widget/bg');
mkdirSync(out, { recursive: true });

// Widget sizes in points on the larger iPhones, drawn at 3x.
const SIZES = { small: [170, 170], medium: [364, 170], large: [364, 382] };
// The scenes are drawn in pixels for a phone-sized page: a skyline is a fixed
// height, not a fraction of the screen. Laid out at widget size, the mosque
// fills the whole frame. So each is laid out on a page ZOOM times larger and
// scaled down, which frames it the way the app does: the sky and its crescent
// above, the city along the bottom edge.
const ZOOM = 2.2;

// The ids, in level order, read from the app's own list.
const list = readFileSync(path.join(repo, 'src/components/backgrounds/backgrounds.tsx'), 'utf8');
const BACKGROUNDS = [...list.slice(list.indexOf('export const BACKGROUNDS')).matchAll(/\{ id: '([a-z-]+)'/g)].map((m) => m[1]);

const server = await createServer({
  root: repo,
  configFile: path.join(repo, 'vite.config.ts'),
  server: { host: '127.0.0.1', port: 4319, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch();
try {
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    const page = await browser.newPage({
      viewport: { width: Math.round(w * ZOOM), height: Math.round(h * ZOOM) },
      deviceScaleFactor: 3 / ZOOM,
    });
    for (const id of BACKGROUNDS) {
      await page.goto(`http://127.0.0.1:4319/scripts/widget-art/index.html?id=${id}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(out, `${id}-${size}.jpg`), type: 'jpeg', quality: 86 });
      console.log(`${id}-${size}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
