import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The Scriptable review page is one big template string in
// scripts/scriptable/wazn-review.js, which nothing else compiles. This builds
// it and parses its script, so a stray backtick or bad escape fails here
// rather than on the phone.
describe('the Scriptable review page', () => {
  const src = readFileSync('scripts/scriptable/wazn-review.js', 'utf8');
  const start = src.indexOf('function scriptCSS(');
  const end = src.indexOf('\nasync function runReview');
  const consts = (src.match(/^const (BRAND|CREAM|INK) = .*$/gm) ?? []).join('\n');
  const reviewHTML = new Function(`${consts}\n${src.slice(start, end)}\nreturn reviewHTML;`)() as (
    cards: unknown[], practice: boolean, pieces: number | 'all', font?: { id: string; family: string; tall?: boolean },
    style?: unknown,
  ) => string;

  it('builds, and its script parses', () => {
    const html = reviewHTML([{ id: 'a', word: 'كتاب', word_type: 'sentence' }], false, 3);
    const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('let PIECES = 3;');
  });

  it('carries the font and background picker, and its script still parses', () => {
    const style = {
      level: 3, bg: 'trellis', font: 'amiri', sample: 'كتاب', art: 'https://x/widget/bg/',
      backgrounds: [{ id: 'parchment', name: 'Parchment', level: 1, bg: '#fff', bg2: null, ink: '#000', accent: '#c00' }],
      fonts: [{ id: 'naskh', name: 'Naskh', blurb: 'b', family: 'Noto Naskh Arabic', level: 1, tall: false }],
    };
    const html = reviewHTML([{ id: 'a', word: 'كتاب' }], false, 'all', { id: 'amiri', family: 'Amiri' }, style);
    expect(html).toContain('id="look"');
    expect(html).toContain('family=Noto+Naskh+Arabic');
    const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('"bg":"trellis"');
  });

  it('sets the cards in the chosen script', () => {
    const html = reviewHTML([{ id: 'a', word: 'كتاب' }], true, 'all', { id: 'nastaliq', family: 'Gulzar', tall: true });
    expect(html).toContain('family=Gulzar:wght@400;700');
    expect(html).toContain(".ar, .tile, .row .val { font-family:'Gulzar'");
    expect(html).toContain('line-height:1.9');
    const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(script)).not.toThrow();
  });
});
