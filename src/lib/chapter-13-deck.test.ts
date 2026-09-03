import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { parseTaggedImport } from './import-tagged';

describe('chapter-13.json', () => {
  const raw = readFileSync('scripts/decks/chapter-13.json', 'utf8');
  const { entries, errors } = parseTaggedImport(raw);

  it('passes the app validator with no errors', () => {
    expect(errors).toEqual([]);
  });

  it('has all 32 words', () => {
    expect(entries).toHaveLength(32);
  });

  it('gives every verb a past and present tense', () => {
    const bad = entries.filter((e) => e.wordType === 'verb' && (!e.pastTense || !e.presentTense));
    expect(bad.map((e) => e.fusha)).toEqual([]);
  });

  it('gives every entry a gloss, a vowelled form and companion forms', () => {
    const bad = entries.filter((e) => !e.english || !e.wordVoweled || e.companionForms.length === 0);
    expect(bad.map((e) => e.fusha)).toEqual([]);
  });

  it('never lists a word as its own companion form', () => {
    const strip = (s: string) =>
      s.split('/')[0].replace(/[ً-ْٰـ]/g, '').trim();
    const bad = entries.filter((e) => e.companionForms.some((c) => strip(c.form) === strip(e.fusha)));
    expect(bad.map((e) => e.fusha)).toEqual([]);
  });

  it('puts every entry in the Chapter 13 group', () => {
    expect([...new Set(entries.map((e) => e.group))]).toEqual(['Chapter 13']);
  });
});
