import { describe, it, expect, vi } from 'vitest';
import type { FlashCard } from '../spaced-repetition';

// The real engine, loaded from node_modules rather than through Vite's ?url wasm import.
vi.mock('./sqlite', async () => {
  const { default: initSqlJs } = await import('sql.js');
  const loading = initSqlJs();
  return { loadSql: () => loading };
});

import { buildApkg, buildAnkiText, noteFields, noteTags, scheduleFor, FIELDS } from './export';
import {
  readAnkiFile, readAnkiText, parseDelimited, guessMapping, planImport, normaliseRoot,
} from './import';
import { cleanField } from './text';

function card(over: Partial<FlashCard> & { id: string; word: string }): FlashCard {
  return {
    english: null,
    imageUrl: null,
    nextReviewDate: '2026-10-10',
    intervalDays: 6,
    easeFactor: 2.5,
    learningStage: 'graduated',
    stage1Attempts: 0,
    stage2Attempts: 2,
    ...over,
  } as FlashCard;
}

const book = card({
  id: 'b1', word: 'كتاب', wordVoweled: 'كِتاب', english: 'book', root: 'ك-ت-ب', wordType: 'noun',
  fushaPlural: 'كُتُب', quranExample: 'ذَٰلِكَ الْكِتَابُ لَا رَيْبَ فِيهِ',
  quranExampleEn: 'This is the Book about which there is no doubt.', quranReference: 'Al-Baqarah 2:2',
});
const write = card({
  id: 'w1', word: 'كتب', wordVoweled: 'كَتَبَ', english: 'to write', root: 'ك-ت-ب', wordType: 'verb',
  verbForm: 'I', pastTense: 'كَتَبَ', presentTense: 'يَكْتُبُ', masdarForm: 'كِتابة', group: 'Unit 1',
});
const fresh = card({ id: 'n1', word: 'بيت', english: 'house <b>&</b> home', learningStage: 'new' as FlashCard['learningStage'] });

describe('cleanField', () => {
  it('strips markup, sound and images, and decodes entities', () => {
    expect(cleanField('<div>book&nbsp;&amp; page</div><br>[sound:a.mp3]<img src="b.jpg">')).toBe('book & page');
  });
});

describe('export', () => {
  it('puts every field in order and escapes HTML', () => {
    const f = noteFields(fresh);
    expect(f).toHaveLength(FIELDS.length);
    expect(f[1]).toBe('house &lt;b&gt;&amp;&lt;/b&gt; home');
  });

  it('tags by type, form and group', () => {
    expect(noteTags(write)).toEqual(['wazn', 'verb', 'form_I', 'Unit_1']);
  });

  it('schedules graduated cards as reviews and the rest as new', () => {
    const now = new Date(2026, 9, 4, 12);
    expect(scheduleFor(fresh, now, 3)).toMatchObject({ type: 0, queue: 0, due: 3 });
    expect(scheduleFor(book, now, 1)).toMatchObject({ type: 2, queue: 2, due: 6, ivl: 6, factor: 2500 });
  });

  it('writes plain text with Anki header lines', () => {
    const text = buildAnkiText([book, write]);
    expect(text.split('\n')[0]).toBe('#separator:tab');
    expect(text).toContain('Al-Baqarah 2:2');
    expect(text.trim().split('\n')).toHaveLength(5 + 2);
  });
});

describe('round trip', () => {
  it('an .apkg we wrote reads back with the same words, verses and roots', async () => {
    const bytes = await buildApkg([book, write, fresh], new Date(2026, 9, 4, 12));
    const sources = await readAnkiFile(bytes);
    expect(sources).toHaveLength(1);
    expect(sources[0].columns).toEqual([...FIELDS]);
    expect(sources[0].rows).toHaveLength(3);

    const mapping = guessMapping(sources[0]);
    expect(mapping).toMatchObject({ arabic: 0, english: 1, plural: 3, root: 4, quran: 6, quranEnglish: 7, quranReference: 8 });

    const plan = planImport(sources[0], mapping, []);
    expect(plan.entries.map((e) => e.fusha)).toEqual(['كِتاب', 'كَتَبَ', 'بيت']);
    expect(plan.entries[0]).toMatchObject({
      english: 'book', root: 'ك-ت-ب', quranReference: 'Al-Baqarah 2:2', fushaPlural: 'كُتُب',
    });
  });

  it('skips words already in the deck', async () => {
    const sources = await readAnkiFile(await buildApkg([book, write], new Date()));
    const plan = planImport(sources[0], guessMapping(sources[0]), [book]);
    expect(plan.entries.map((e) => e.english)).toEqual(['to write']);
    expect(plan.duplicates).toBe(1);
  });

  it('reads the plain-text export back too', () => {
    const source = readAnkiText(buildAnkiText([book, write]));
    expect(source.columns).toEqual([...FIELDS]);
    const plan = planImport(source, guessMapping(source), []);
    expect(plan.entries).toHaveLength(2);
    expect(plan.entries[0].quranExample).toContain('الْكِتَابُ');
  });
});

describe('reading foreign decks', () => {
  it('maps Front/Back by content, swapping when Arabic is on the back', () => {
    const source = readAnkiText('house\tبيت\nطاولة\ttable\n');
    const plan = planImport(source, guessMapping(source), []);
    expect(plan.entries.map((e) => [e.fusha, e.english])).toEqual([['بيت', 'house'], ['طاولة', 'table']]);
  });

  it('splits a cell holding both languages', () => {
    const source = readAnkiText('كتاب (book)\n');
    const plan = planImport(source, { ...guessMapping(source), arabic: 0, english: null }, []);
    expect(plan.entries[0]).toMatchObject({ fusha: 'كتاب', english: 'book' });
  });

  it('honours a declared separator, quoted cells and a tags column', () => {
    const source = readAnkiText('#separator:semicolon\n#tags column:3\nكلب;"a ""dog""\nnewline";pets\n');
    expect(source.columns).toHaveLength(2);
    expect(source.rows[0][1]).toBe('a "dog"\nnewline');
  });

  it('counts rows with no Arabic as unreadable', () => {
    const source = readAnkiText('hello\tworld\n');
    expect(planImport(source, { ...guessMapping(source), arabic: 0 }, []).unreadable).toBe(1);
  });

  it('refuses the newest package format with a plain message', async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('collection.anki21b', new Uint8Array([1, 2, 3]));
    const bytes = await zip.generateAsync({ type: 'uint8array' });
    await expect(readAnkiFile(bytes)).rejects.toThrow(/newest format/);
  });

  it('parseDelimited ignores blank lines', () => {
    expect(parseDelimited('a\tb\n\nc\td\n', '\t')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('normaliseRoot accepts spaced or dotted letters only when 3-4 letters', () => {
    expect(normaliseRoot('ك ت ب')).toBe('ك-ت-ب');
    expect(normaliseRoot('ك.ت.ب')).toBe('ك-ت-ب');
    expect(normaliseRoot('كتابة')).toBeNull();
    expect(normaliseRoot('')).toBeNull();
  });
});
