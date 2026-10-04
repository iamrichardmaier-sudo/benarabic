import JSZip from 'jszip';
import type { FlashCard } from '../spaced-repetition';
import { today } from '../day';
import { escapeHtml } from './text';
import { loadSql } from './sqlite';

/**
 * Taking the deck out of Wazn and into Anki.
 *
 * Two formats, because they answer different needs:
 *
 * - .apkg, Anki's own package: opens with a double-click, brings the cards
 *   across with their schedule (due dates, intervals, ease), and carries the
 *   Qur'an reference, the root and the forms as fields;
 * - plain text, which every version of Anki, and most other flashcard apps,
 *   can import, and which a person can open and read.
 *
 * Neither needs an account or leaves the device: the file is built here.
 */

export const DECK_NAME = 'Wazn Arabic';

/** The note type's fields, in order. Index 0 is the sort field. */
export const FIELDS = [
  'Arabic', 'English', 'Shaami', 'Plural', 'Root', 'Forms',
  'Quran', 'QuranEnglish', 'QuranReference', 'Image',
] as const;

const F = Object.fromEntries(FIELDS.map((name, i) => [name, i])) as Record<(typeof FIELDS)[number], number>;

const SEPARATOR = '\x1f';
const MODEL_NAME = 'Wazn Arabic';

/** Anki ids are millisecond timestamps; these are fixed so a re-export updates rather than duplicates the note type. */
const MODEL_ID = 1700000000000;
const PARENT_DECK_ID = 1700000000001;

const CSS = `
.card { font-family: "Amiri", "Geeza Pro", "Traditional Arabic", Arial, sans-serif; font-size: 20px; text-align: center; color: #222; background: #fff; }
.ar { font-size: 44px; direction: rtl; line-height: 1.5; }
.ar-sm { font-size: 24px; direction: rtl; }
.en { font-size: 26px; }
.meta { font-size: 16px; color: #666; margin-top: 6px; }
.quran { margin-top: 18px; padding-top: 10px; border-top: 1px solid #ddd; }
.quran .label { font-size: 11px; letter-spacing: .09em; text-transform: uppercase; color: #999; }
.quran .ref { font-size: 13px; color: #999; }
.nightMode .card { color: #eee; background: #222; }
`.trim();

const EXTRAS =
  '{{#Image}}<div>{{Image}}</div>{{/Image}}' +
  '{{#Shaami}}<div class="meta">Shaami: <span class="ar-sm">{{Shaami}}</span></div>{{/Shaami}}' +
  '{{#Plural}}<div class="meta">Plural: <span class="ar-sm">{{Plural}}</span></div>{{/Plural}}' +
  '{{#Root}}<div class="meta">Root: <span class="ar-sm">{{Root}}</span></div>{{/Root}}' +
  '{{#Forms}}<div class="meta">{{Forms}}</div>{{/Forms}}' +
  '{{#Quran}}<div class="quran"><div class="label">Quranic reference</div>' +
  '<div class="ar-sm">{{Quran}}</div><div>{{QuranEnglish}}</div>' +
  '<div class="ref">{{QuranReference}}</div></div>{{/Quran}}';

const TEMPLATES = [
  {
    name: 'Arabic → English',
    qfmt: '<div class="ar">{{Arabic}}</div>',
    afmt: `{{FrontSide}}<hr id="answer"><div class="en">{{English}}</div>${EXTRAS}`,
  },
  {
    name: 'English → Arabic',
    qfmt: '<div class="en">{{English}}</div>',
    afmt: `{{FrontSide}}<hr id="answer"><div class="ar">{{Arabic}}</div>${EXTRAS}`,
  },
];

function formsLine(card: FlashCard): string {
  const bits: string[] = [];
  const add = (label: string, value?: string | null) => {
    if (value) bits.push(`${label}: <span class="ar-sm">${escapeHtml(value)}</span>`);
  };
  add('Past', card.pastTense);
  add('Present', card.presentTense);
  add('Masdar', card.masdarForm);
  return bits.join(' · ');
}

/** The note's fields, in FIELDS order, as the HTML Anki stores. */
export function noteFields(card: FlashCard): string[] {
  const out: string[] = FIELDS.map(() => '');
  out[F.Arabic] = escapeHtml(card.wordVoweled || card.word);
  out[F.English] = escapeHtml(card.english ?? '');
  out[F.Shaami] = escapeHtml(card.shaami ?? '');
  out[F.Plural] = escapeHtml(card.fushaPlural ?? '');
  out[F.Root] = escapeHtml(card.root ?? '');
  out[F.Forms] = formsLine(card);
  out[F.Quran] = escapeHtml(card.quranExample ?? '');
  out[F.QuranEnglish] = escapeHtml(card.quranExampleEn ?? '');
  out[F.QuranReference] = escapeHtml(card.quranReference ?? '');
  out[F.Image] = card.imageUrl && /^https?:\/\//.test(card.imageUrl)
    ? `<img src="${escapeHtml(card.imageUrl)}">`
    : '';
  return out;
}

/** Anki tags are space-separated, so spaces inside one become underscores. */
function tagWord(value: string): string {
  return value.trim().replace(/\s+/g, '_');
}

export function noteTags(card: FlashCard): string[] {
  const tags = ['wazn'];
  if (card.wordType) tags.push(tagWord(card.wordType));
  if (card.verbForm) tags.push(`form_${card.verbForm}`);
  if (card.group) tags.push(tagWord(card.group));
  return tags;
}

function deckNameFor(card: FlashCard): string {
  return card.group ? `${DECK_NAME}::${card.group.replace(/::/g, ':')}` : DECK_NAME;
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

/**
 * How Anki should see a card's schedule.
 *
 * A card still being learned is a new card. A graduated one is a review card
 * due in so many days from now — overdue cards are simply due today, because
 * Anki's own overdue handling will do a better job than a guess here.
 */
export function scheduleFor(card: FlashCard, now: Date, newPosition: number) {
  if (card.learningStage !== 'graduated') {
    return { type: 0, queue: 0, due: newPosition, ivl: 0, factor: 0, reps: 0 };
  }
  const due = Math.max(0, dayDiff(today(now), card.nextReviewDate));
  return {
    type: 2,
    queue: 2,
    due,
    ivl: Math.max(1, Math.round(card.intervalDays || 1)),
    factor: Math.round((card.easeFactor || 2.5) * 1000),
    reps: Math.max(1, card.stage2Attempts || 1),
  };
}

async function checksum(firstField: string): Promise<number> {
  const stripped = firstField.replace(/<[^>]*>/g, '');
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(stripped));
  const hex = [...new Uint8Array(digest)].slice(0, 4).map((b) => b.toString(16).padStart(2, '0')).join('');
  return parseInt(hex, 16);
}

const SCHEMA = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null, scm integer not null, ver integer not null, dty integer not null, usn integer not null, ls integer not null, conf text not null, models text not null, decks text not null, dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null, mod integer not null, usn integer not null, tags text not null, flds text not null, sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null, ord integer not null, mod integer not null, usn integer not null, type integer not null, queue integer not null, due integer not null, ivl integer not null, factor integer not null, reps integer not null, lapses integer not null, left integer not null, odue integer not null, odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null, ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null, time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn on notes (usn);
CREATE INDEX ix_cards_usn on cards (usn);
CREATE INDEX ix_revlog_usn on revlog (usn);
CREATE INDEX ix_cards_nid on cards (nid);
CREATE INDEX ix_cards_sched on cards (did, queue, due);
CREATE INDEX ix_revlog_cid on revlog (cid);
CREATE INDEX ix_notes_csum on notes (csum);
`;

function modelJson(nowSec: number): string {
  return JSON.stringify({
    [MODEL_ID]: {
      id: MODEL_ID,
      name: MODEL_NAME,
      type: 0,
      mod: nowSec,
      usn: -1,
      sortf: 0,
      did: PARENT_DECK_ID,
      tmpls: TEMPLATES.map((t, ord) => ({
        name: t.name, ord, qfmt: t.qfmt, afmt: t.afmt,
        bqfmt: '', bafmt: '', did: null, bfont: '', bsize: 0,
      })),
      flds: FIELDS.map((name, ord) => ({
        name, ord, sticky: false, rtl: ord !== F.English && ord !== F.QuranEnglish && ord !== F.Image && ord !== F.QuranReference,
        font: 'Arial', size: 20, media: [],
      })),
      css: CSS,
      latexPre: '\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n',
      latexPost: '\\end{document}',
      latexsvg: false,
      req: [[0, 'any', [F.Arabic]], [1, 'any', [F.English]]],
      tags: [],
      vers: [],
    },
  });
}

function deckJson(id: number, name: string, nowSec: number) {
  return {
    id, name, mod: nowSec, usn: -1, desc: '', dyn: 0, conf: 1, collapsed: false,
    browserCollapsed: false, extendNew: 0, extendRev: 0,
    lrnToday: [0, 0], newToday: [0, 0], revToday: [0, 0], timeToday: [0, 0],
  };
}

const DCONF = JSON.stringify({
  1: {
    id: 1, mod: 0, name: 'Default', usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true,
    new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20, separate: true },
    lapse: { delays: [10], leechAction: 0, leechFails: 8, minInt: 1, mult: 0 },
    rev: { bury: true, ease4: 1.3, fuzz: 0.05, ivlFct: 1, maxIvl: 36500, minSpace: 1, perDay: 100 },
  },
});

/** The deck as an Anki package. */
export async function buildApkg(cards: FlashCard[], now: Date = new Date()): Promise<Uint8Array> {
  const SQL = await loadSql();
  const db = new SQL.Database();
  const nowSec = Math.floor(now.getTime() / 1000);
  const base = now.getTime();

  try {
    db.run(SCHEMA);

    // One deck per group, under the parent. Ids are derived from position so a
    // deck keeps its id across the notes that belong to it.
    const deckIds = new Map<string, number>();
    const decks: Record<string, unknown> = {
      1: deckJson(1, 'Default', nowSec),
      [PARENT_DECK_ID]: deckJson(PARENT_DECK_ID, DECK_NAME, nowSec),
    };
    deckIds.set(DECK_NAME, PARENT_DECK_ID);
    for (const card of cards) {
      const name = deckNameFor(card);
      if (deckIds.has(name)) continue;
      const id = PARENT_DECK_ID + 1 + deckIds.size;
      deckIds.set(name, id);
      decks[id] = deckJson(id, name, nowSec);
    }

    const conf = JSON.stringify({
      nextPos: cards.length + 1, estTimes: true, activeDecks: [PARENT_DECK_ID], sortType: 'noteFld',
      timeLim: 0, sortBackwards: false, addToCur: true, curDeck: PARENT_DECK_ID, newBury: true,
      newSpread: 0, dueCounts: true, curModel: String(MODEL_ID), collapseTime: 1200,
    });

    db.run('INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, ?)', [
      nowSec - (nowSec % 86400), base, base, conf, modelJson(nowSec), JSON.stringify(decks), DCONF, '{}',
    ]);

    const noteStmt = db.prepare('INSERT INTO notes VALUES (?, ?, ?, ?, -1, ?, ?, ?, ?, 0, \'\')');
    const cardStmt = db.prepare(
      'INSERT INTO cards VALUES (?, ?, ?, ?, ?, -1, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0, 0, \'\')',
    );

    let position = 1;
    let n = 0;
    for (const card of cards) {
      const fields = noteFields(card);
      const noteId = base + n;
      const did = deckIds.get(deckNameFor(card)) ?? PARENT_DECK_ID;

      noteStmt.run([
        noteId,
        // The card's own id, so importing this file back into Wazn recognises
        // what is already there instead of adding it a second time.
        card.id,
        MODEL_ID,
        nowSec,
        ` ${noteTags(card).join(' ')} `,
        fields.join(SEPARATOR),
        fields[F.Arabic].replace(/<[^>]*>/g, ''),
        await checksum(fields[F.Arabic]),
      ]);

      const sched = scheduleFor(card, now, position);
      const ords = fields[F.English] ? [0, 1] : [0];
      ords.forEach((ord) => {
        cardStmt.run([
          base + 1_000_000 + n * 2 + ord, noteId, did, ord, nowSec,
          sched.type, sched.queue, sched.due, sched.ivl, sched.factor, sched.reps,
        ]);
      });
      if (sched.type === 0) position += 1;
      n += 1;
    }
    noteStmt.free();
    cardStmt.free();

    const zip = new JSZip();
    zip.file('collection.anki2', db.export());
    zip.file('media', '{}');
    return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  } finally {
    db.close();
  }
}

/** A field with the characters a tab-separated file cannot hold made safe. */
function textCell(value: string): string {
  const flat = value.replace(/[\t\r\n]+/g, ' ');
  return /"/.test(flat) ? `"${flat.replace(/"/g, '""')}"` : flat;
}

/**
 * The deck as Anki's "Notes in Plain Text": one note per line, tab-separated,
 * with the header lines Anki reads to set itself up.
 */
export function buildAnkiText(cards: FlashCard[]): string {
  const lines = [
    '#separator:tab',
    '#html:true',
    `#columns:${FIELDS.join('\t')}\tTags`,
    `#tags column:${FIELDS.length + 1}`,
    `#deck column:${FIELDS.length + 2}`,
  ];
  for (const card of cards) {
    const cells = [...noteFields(card), noteTags(card).join(' '), deckNameFor(card)];
    lines.push(cells.map(textCell).join('\t'));
  }
  return `${lines.join('\n')}\n`;
}
