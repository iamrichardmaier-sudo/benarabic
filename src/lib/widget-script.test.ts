import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The Scriptable review page is one big template string in
// scripts/scriptable/wazn-review.js, which nothing else compiles. This builds
// it and parses its script, so a stray backtick or bad escape fails here
// rather than on the phone.
describe('the Scriptable review page', () => {
  const src = readFileSync('scripts/scriptable/wazn-review.js', 'utf8');
  const start = src.indexOf('function reviewHTML(');
  const end = src.indexOf('\nasync function runReview');
  const consts = (src.match(/^const (BRAND|CREAM|INK) = .*$/gm) ?? []).join('\n');
  const reviewHTML = new Function(`${consts}\n${src.slice(start, end)}\nreturn reviewHTML;`)() as (
    cards: unknown[], practice: boolean, pieces: number | 'all',
  ) => string;

  it('builds, and its script parses', () => {
    const html = reviewHTML([{ id: 'a', word: 'كتاب', word_type: 'sentence' }], false, 3);
    const script = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('let PIECES = 3;');
  });
});
