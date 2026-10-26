import { describe, it, expect } from 'vitest';
import { LEVEL_XP, MAX_LEVEL, XP_FOR_RATING, levelFor, progressFor, xpForGrade } from './levels';

describe('levels', () => {
  it('has 15 levels on a rising curve', () => {
    expect(LEVEL_XP).toHaveLength(MAX_LEVEL);
    expect(LEVEL_XP.slice(0, 4)).toEqual([0, 250, 1000, 2250]);
    expect(LEVEL_XP[14]).toBe(49000);
  });

  it('maps XP to a level, capped at the top', () => {
    expect(levelFor(0)).toBe(1);
    expect(levelFor(249)).toBe(1);
    expect(levelFor(250)).toBe(2);
    expect(levelFor(48999)).toBe(14);
    expect(levelFor(10_000_000)).toBe(15);
  });

  it('reports progress through the current level', () => {
    expect(progressFor(625)).toMatchObject({ level: 2, floor: 250, next: 1000, fraction: 0.5, toNext: 375 });
    expect(progressFor(60000)).toMatchObject({ level: 15, next: null, fraction: 1, toNext: 0 });
  });

  it('pays the same for good and easy, and half for practice', () => {
    expect(xpForGrade('good')).toBe(xpForGrade('easy'));
    expect(xpForGrade('again')).toBeLessThan(xpForGrade('hard'));
    expect(xpForGrade('good', true)).toBe(5);
    expect(xpForGrade('again', true)).toBe(2);
  });
});

describe('the Scriptable widget', () => {
  // The widget carries its own copy of the XP table and level thresholds.
  it('uses the same XP and levels as the app', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('scripts/scriptable/wazn-review.js', 'utf8');
    const block = src.slice(src.indexOf('const XP_FOR_RATING'), src.indexOf('function xpFor'));
    const widget = new Function(`${block}; return { XP_FOR_RATING, LEVEL_XP };`)();
    expect(widget.XP_FOR_RATING).toEqual(XP_FOR_RATING);
    expect(widget.LEVEL_XP).toEqual([...LEVEL_XP]);
  });
});

describe('the widget colours', () => {
  it('has a theme for every background, in level order', async () => {
    const { readFileSync } = await import('node:fs');
    const { BACKGROUNDS } = await import('@/components/backgrounds/backgrounds');
    const src = readFileSync('scripts/scriptable/wazn-review.js', 'utf8');
    const start = src.indexOf('const WIDGET_THEMES = {');
    const block = src.slice(start, src.indexOf('};', start));
    const ids = [...block.matchAll(/^\s+"?([a-z-]+)"?:\s*\{/gm)].map((m) => m[1]);
    expect(ids).toEqual(BACKGROUNDS.map((b) => b.id));
  });
});
