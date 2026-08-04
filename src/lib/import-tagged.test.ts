import { describe, it, expect } from 'vitest';
import { parseTaggedImport, sanitizeJsonText, looksLikeJson } from './import-tagged';

const ENTRY = '{"fusha":"جَبَل","english":"mountain","fushaPlural":"جِبال","wordType":"noun"}';
const GOOD = `[${ENTRY}]`;

describe('sanitizeJsonText', () => {
  it('strips a markdown code fence copied along with the data', () => {
    expect(sanitizeJsonText('```json\n' + GOOD + '\n```')).toBe(GOOD);
  });

  it('strips bidi marks that copying Arabic injects between tokens', () => {
    const corrupted = `[\u200f${ENTRY}\u200e]`;
    expect(sanitizeJsonText(corrupted)).toBe(GOOD);
  });

  it('converts non-breaking spaces from HTML rendering', () => {
    expect(sanitizeJsonText(`[\u00a0${ENTRY}\u00a0]`)).toBe(`[ ${ENTRY} ]`);
  });

  it('converts smart quotes back to straight quotes', () => {
    expect(sanitizeJsonText('[{\u201cfusha\u201d:\u201cx\u201d}]')).toBe('[{"fusha":"x"}]');
  });

  it('drops prose pasted before or after the array', () => {
    expect(sanitizeJsonText('Here you go:\n' + GOOD + '\nEnjoy!')).toBe(GOOD);
  });
});

describe('parseTaggedImport resilience', () => {
  const cases: [string, string][] = [
    ['clean', GOOD],
    ['fenced', '```json\n' + GOOD + '\n```'],
    ['bidi-marked', `[\u200f${ENTRY}\u200e]`],
    ['nbsp', `[\u00a0${ENTRY}\u00a0]`],
    ['with prose', 'Here:\n' + GOOD],
  ];

  it.each(cases)('imports %s input without errors', (_name, text) => {
    const { entries, errors } = parseTaggedImport(text);
    expect(errors).toEqual([]);
    expect(entries[0].fusha).toBe('جَبَل');
    expect(entries[0].fushaPlural).toBe('جِبال');
  });
});

describe('looksLikeJson', () => {
  it('detects a dataset even when fenced', () => {
    expect(looksLikeJson('```json\n' + GOOD + '\n```')).toBe(true);
  });
  it('rejects an ordinary word list', () => {
    expect(looksLikeJson('جَبَل | mountain')).toBe(false);
  });
});

describe('group assignment on import', () => {
  const base = '"fusha": "كِتاب", "english": "book"';

  it('carries a group through to the entry', () => {
    const { entries, errors } = parseTaggedImport(`[{${base}, "group": "Chapter 12"}]`);
    expect(errors).toEqual([]);
    expect(entries[0].group).toBe('Chapter 12');
  });

  it('leaves the group null when the field is absent', () => {
    const { entries } = parseTaggedImport(`[{${base}}]`);
    expect(entries[0].group).toBeNull();
  });

  it('treats a blank group as no group', () => {
    const { entries } = parseTaggedImport(`[{${base}, "group": "   "}]`);
    expect(entries[0].group).toBeNull();
  });

  it('lets different entries carry different groups', () => {
    const { entries } = parseTaggedImport(
      `[{${base}, "group": "Chapter 12"}, {"fusha": "قَلَم", "english": "pen", "group": "Chapter 13"}]`,
    );
    expect(entries.map((e) => e.group)).toEqual(['Chapter 12', 'Chapter 13']);
  });
});
