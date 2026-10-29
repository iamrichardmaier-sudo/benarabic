/**
 * Draws one level background at a fixed size, for render.mjs to photograph.
 * ?id=<background id>  — and the page is sized by the browser viewport.
 *
 * The art is the app's own components, so the widget shows the very drawing
 * the app shows rather than an approximation of it. Night scenes get the
 * app's dark palette, as AppBackground gives them; the rest the light one.
 */
import { createRoot } from 'react-dom/client';
import '@/index.css';
import { backgroundById } from '@/components/backgrounds/backgrounds';

const id = new URLSearchParams(location.search).get('id');
const bg = backgroundById(id);
if (bg.tone === 'dark') document.documentElement.classList.add('dark');
document.body.style.margin = '0';
const Art = bg.Art;

createRoot(document.getElementById('root')!).render(
  <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'hsl(var(--background))' }}>
    {Art && <Art still />}
    {/* A soft wash where the widget sets its word, so the text never has to
        fight a lantern or a dome for contrast. Edges stay untouched. */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          bg.tone === 'dark'
            ? [
                'radial-gradient(ellipse 80% 62% at 50% 48%, rgba(10,8,24,.62), rgba(10,8,24,0) 100%)',
                // The header and the level bar sit on these two edges.
                'linear-gradient(to bottom, rgba(10,8,24,.5), rgba(10,8,24,0) 30%, rgba(10,8,24,0) 72%, rgba(10,8,24,.45))',
              ].join(', ')
            : [
                'radial-gradient(ellipse 80% 62% at 50% 48%, hsl(var(--background) / .82), hsl(var(--background) / 0) 100%)',
                'linear-gradient(to bottom, hsl(var(--background) / .55), hsl(var(--background) / 0) 30%, hsl(var(--background) / 0) 72%, hsl(var(--background) / .5))',
              ].join(', '),
      }}
    />
  </div>,
);
