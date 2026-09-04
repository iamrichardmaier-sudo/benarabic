import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { parseTaggedImport } from './import-tagged';

/**
 * Every checked-in deck is validated the same way, so a new batch is covered
 * the moment its file lands rather than when someone remembers to add a test.
 *
 * These run through parseTaggedImport — the app's own importer — rather than
 * merely checking the files parse as JSON, so a deck that would be rejected on
 * paste fails here instead.
 */
const DIR = 'scripts/decks';
const FILES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();

it('finds the deck files', () => {
  expect(FILES.length).toBeGreaterThan(0);
});

describe.each(FILES)('%s', (file) => {
  const { entries, errors } = parseTaggedImport(readFileSync(`${DIR}/${file}`, 'utf8'));

  it('passes the app validator with no errors', () => {
    expect(errors).toEqual([]);
  });

  it('gives every verb a past and a present tense', () => {
    const bad = entries.filter((e) => e.wordType === 'verb' && (!e.pastTense || !e.presentTense));
    expect(bad.map((e) => e.fusha)).toEqual([]);
  });

  it('gives every entry a gloss, a vowelled form and companion forms', () => {
    const bad = entries.filter((e) => !e.english || !e.wordVoweled || e.companionForms.length === 0);
    expect(bad.map((e) => e.fusha)).toEqual([]);
  });

  // Compared as written, not by skeleton. A word family is *made of* words
  // that share a root and therefore often a skeleton — صَبر beside صَبَرَ,
  // مُلهِم beside مُلهَم — and collapsing those would throw the section away.
  // Where the same word really does appear twice in two spellings (الشُّكر as
  // the masdar, شُكر in the family) it is the renderer that drops it, via
  // visibleCompanions, so that the 400-odd older cards are covered too.
  it('never lists a word as its own companion form', () => {
    const bad = entries.filter((e) =>
      e.companionForms.some((c) => c.form.trim() === (e.wordVoweled || e.fusha).trim()),
    );
    expect(bad.map((e) => e.fusha)).toEqual([]);
  });

  it('never repeats a companion form within one entry', () => {
    const bad = entries.filter((e) => {
      const forms = e.companionForms.map((c) => c.form.trim());
      return new Set(forms).size !== forms.length;
    });
    expect(bad.map((e) => e.fusha)).toEqual([]);
  });

  // A file is either a named batch (a textbook chapter, a course list) or a
  // loose set of words that belongs under no heading at all — a conversation
  // someone wrote down. Both are fine; a file that mixes them is not, because
  // the group is what the app filters study by.
  it('agrees with itself about the group', () => {
    const groups = [...new Set(entries.map((e) => e.group ?? null))];
    expect(groups).toHaveLength(1);
  });

  it('has no duplicate headwords', () => {
    // As written again: فُرصة and فُرصة سَعيدة! are different entries, and so
    // are a noun and the verb it comes from.
    const keys = entries.map((e) => (e.wordVoweled || e.fusha).trim());
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('the decks together', () => {
  const all = FILES.flatMap(
    (f) => parseTaggedImport(readFileSync(`${DIR}/${f}`, 'utf8')).entries,
  );

  it('holds the expected number of words', () => {
    expect(all).toHaveLength(94);
  });

  it('names each group once', () => {
    const named = [...new Set(all.map((e) => e.group).filter(Boolean))].sort();
    expect(named).toEqual(['Chapter 13', 'Embark']);
  });

  it('has no word appearing in two decks', () => {
    const keys = all.map((e) => (e.wordVoweled || e.fusha).trim());
    const seen = new Set<string>();
    const repeated = keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false)));
    expect(repeated).toEqual([]);
  });
});
