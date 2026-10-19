import { describe, expect, it } from 'vitest';
import { shortDefinition } from './data';

describe('shortDefinition', () => {
  it('keeps the first senses that fit', () => {
    expect(shortDefinition('to take; to get; to receive; to obtain; to seize')).toBe('to take; to get; to receive');
  });
  it('always keeps the first sense, however long', () => {
    const long = 'to move out of a place, to exit, to leave, to get out of somewhere and not come back again at all';
    expect(shortDefinition(`${long}; to emerge`)).toBe(long);
  });
  it('is null when there is nothing to show', () => {
    expect(shortDefinition(null)).toBeNull();
    expect(shortDefinition(' ; ')).toBeNull();
  });
});
