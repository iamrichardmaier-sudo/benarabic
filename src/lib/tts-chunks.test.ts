import { describe, it, expect } from 'vitest';
import { chunkForSpeech, tidyForSpeech, estimateSeconds, MAX_CHUNK } from './tts-chunks';

describe('tidyForSpeech', () => {
  it('rejoins a word broken across a line break', () => {
    // Read literally this is "under" then "stand", which is audible.
    expect(tidyForSpeech('under-\nstanding the text')).toBe('understanding the text');
  });

  it('runs a wrapped paragraph back into one line', () => {
    expect(tidyForSpeech('the quick brown\nfox jumps over')).toBe('the quick brown fox jumps over');
  });

  it('keeps a real paragraph break', () => {
    expect(tidyForSpeech('first para\n\nsecond para')).toBe('first para\n\nsecond para');
  });

  it('drops a line that is only a page number', () => {
    expect(tidyForSpeech('end of page\n 12 \nnext page')).toBe('end of page\n\nnext page');
  });
});

describe('chunkForSpeech', () => {
  it('returns nothing for nothing', () => {
    expect(chunkForSpeech('   ')).toEqual([]);
  });

  it('keeps a short passage whole', () => {
    expect(chunkForSpeech('One sentence. Two sentences.')).toEqual([
      'One sentence. Two sentences.',
    ]);
  });

  it('never hands over more than the limit', () => {
    const text = Array.from({ length: 60 }, (_, i) => `This is sentence number ${i}.`).join(' ');
    for (const chunk of chunkForSpeech(text)) {
      expect(chunk.length).toBeLessThanOrEqual(MAX_CHUNK);
    }
  });

  it('breaks at sentence ends, so the joins fall where a reader pauses', () => {
    const text = Array.from({ length: 40 }, () => 'A fairly ordinary sentence here.').join(' ');
    const chunks = chunkForSpeech(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.endsWith('.')).toBe(true);
  });

  it('splits a single over-long sentence at a comma rather than mid-word', () => {
    const clause = 'a clause of some length that carries on, ';
    const chunks = chunkForSpeech(clause.repeat(30), 120);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(120);
      // A cut inside a word would leave a fragment; every piece ends on a
      // whole word.
      expect(chunk).not.toMatch(/\s$/);
      expect(chunk.trim()).toBe(chunk);
    }
    expect(chunks.join(' ')).toContain('carries on');
  });

  it('loses no words', () => {
    const text = Array.from({ length: 50 }, (_, i) => `Sentence ${i} of the document.`).join(' ');
    const before = text.split(/\s+/).filter(Boolean).length;
    const after = chunkForSpeech(text).join(' ').split(/\s+/).filter(Boolean).length;
    expect(after).toBe(before);
  });

  it('treats a paragraph break as a break', () => {
    expect(chunkForSpeech('First part\n\nSecond part')).toEqual(['First part', 'Second part']);
  });
});

describe('estimateSeconds', () => {
  it('reads about 165 words a minute', () => {
    const text = Array.from({ length: 165 }, () => 'word').join(' ');
    expect(estimateSeconds(text)).toBe(60);
  });

  it('is zero for an empty document', () => {
    expect(estimateSeconds('')).toBe(0);
  });
});
