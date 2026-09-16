import { describe, it, expect } from 'vitest';
import { toPcm16, concatSamples, silence, audioFileName } from './mp3';

describe('toPcm16', () => {
  it('maps the full range without wrapping', () => {
    const out = toPcm16(new Float32Array([0, 1, -1]));
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(32767);
    expect(out[2]).toBe(-32768);
  });

  it('clamps a sample past the ceiling instead of wrapping it', () => {
    // Left unclamped, 1.2 overflows to a large negative number, which is an
    // audible click rather than a loud sample.
    const out = toPcm16(new Float32Array([1.2, -1.5]));
    expect(out[0]).toBe(32767);
    expect(out[1]).toBe(-32768);
  });
});

describe('concatSamples', () => {
  it('joins the pieces end to end in order', () => {
    const out = concatSamples([new Float32Array([1, 2]), new Float32Array([3])]);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });

  it('handles nothing at all', () => {
    expect(concatSamples([]).length).toBe(0);
  });
});

describe('silence', () => {
  it('is as long as it was asked to be', () => {
    expect(silence(0.5, 24000).length).toBe(12000);
    expect(silence(0.5, 24000).every((s) => s === 0)).toBe(true);
  });

  it('is never a negative length', () => {
    expect(silence(-1, 24000).length).toBe(0);
  });
});

describe('audioFileName', () => {
  it('keeps the document name and changes the extension', () => {
    expect(audioFileName('Chapter 4 Notes.pdf')).toBe('Chapter-4-Notes.mp3');
  });

  it('drops the characters a filesystem would object to', () => {
    expect(audioFileName('a/b:c?.pdf')).toBe('abc.mp3');
  });

  it('falls back to a name rather than producing a bare extension', () => {
    expect(audioFileName('???.pdf')).toBe('reading.mp3');
  });
});
