import JSZip from 'jszip';
import type { FlashCard, WordType } from '../spaced-repetition';
import type { TaggedImportEntry } from '../import-tagged';
import { wordKey } from '../word-relations';
import { cleanField, hasArabic, hasLatin } from './text';
import { loadSql } from './sqlite';

/**
 * Bringing a deck from Anki into Wazn.
 *
 * Anki decks arrive as a package (.apkg) or as "Notes in Plain Text" (.txt,
 * .tsv, .csv). Both are reduced to the same thing — a table of fields — so one
 * mapping step and one conversion serve either. What is brought across is the
 * vocabulary, not the schedule: a foreign deck's review history does not
 * describe how well *this* learner knows the words in Wazn's own scheduler, and
 * guessing would put cards on a calendar they have not earned.
 */

export class AnkiImportError extends Error {}

/** One note type's worth of notes. */
export interface AnkiSource {
  label: string;
  columns: string[];
  /** Raw field HTML, one array per note, in `columns` order. */
  rows: string[][];
}

const ZIP_MAGIC = [0x50, 0x4b];

function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes[0] === ZIP_MAGIC[0] && bytes[1] === ZIP_MAGIC[1];
}

/** Read whatever the learner picked. */
export async function readAnkiFile(bytes: Uint8Array): Promise<AnkiSource[]> {
  if (looksLikeZip(bytes)) return readApkg(bytes);
  return [readAnkiText(new TextDecoder('utf-8').decode(bytes))];
}

interface ModelInfo {
  name: string;
  fields: string[];
}

function readModels(db: import('sql.js').Database): Map<number, ModelInfo> {
  const models = new Map<number, ModelInfo>();

  // Older collections keep the note types as JSON on the one `col` row.
  try {
    const res = db.exec('SELECT models FROM col');
    const json = res[0]?.values[0]?.[0];
    if (typeof json === 'string' && json.trim().startsWith('{')) {
      const parsed = JSON.parse(json) as Record<string, { id: number; name: string; flds: { name: string; ord: number }[] }>;
      for (const m of Object.values(parsed)) {
        models.set(Number(m.id), {
          name: m.name,
          fields: [...m.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name),
        });
      }
    }
  } catch {
    /* fall through to the newer layout */
  }
  if (models.size > 0) return models;

  // Newer ones have real tables.
  try {
    const types = db.exec('SELECT id, name FROM notetypes')[0]?.values ?? [];
    const fields = db.exec('SELECT ntid, ord, name FROM fields ORDER BY ntid, ord')[0]?.values ?? [];
    for (const [id, name] of types) models.set(Number(id), { name: String(name), fields: [] });
    for (const [ntid, , name] of fields) models.get(Number(ntid))?.fields.push(String(name));
  } catch {
    /* no note types we can read; callers fall back to numbered columns */
  }
  return models;
}

async function readApkg(bytes: Uint8Array): Promise<AnkiSource[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    throw new AnkiImportError('That file is not a readable Anki package.');
  }

  // Prefer the newest legacy-format database; anki21b is a compressed, protobuf
  // layout this reader does not speak, and says so rather than guessing.
  const entry = zip.file('collection.anki21') ?? zip.file('collection.anki2');
  const modern = zip.file('collection.anki21b');
  if (!entry) {
    throw new AnkiImportError(
      modern
        ? 'This package uses Anki’s newest format. In Anki, export again with “Support older Anki versions” ticked, or export as “Notes in Plain Text”.'
        : 'No Anki collection was found inside that file.',
    );
  }

  const SQL = await loadSql();
  const db = new SQL.Database(await entry.async('uint8array'));
  try {
    const rows = db.exec('SELECT mid, flds FROM notes')[0]?.values ?? [];

    // Newer Anki writes a one-note placeholder here and keeps the real deck in anki21b.
    const isStub = rows.length <= 1 && rows.some(([, flds]) => /update to the latest Anki version/i.test(String(flds)));
    if (isStub) {
      throw new AnkiImportError(
        'This package uses Anki’s newest format. In Anki, export again with “Support older Anki versions” ticked, or export as “Notes in Plain Text”.',
      );
    }

    const models = readModels(db);
    const byModel = new Map<number, string[][]>();
    for (const [mid, flds] of rows) {
      const list = byModel.get(Number(mid)) ?? [];
      list.push(String(flds).split('\x1f'));
      byModel.set(Number(mid), list);
    }

    const sources: AnkiSource[] = [];
    for (const [mid, list] of byModel) {
      const model = models.get(mid);
      const width = Math.max(...list.map((r) => r.length));
      const columns = Array.from({ length: width }, (_, i) => model?.fields[i] ?? `Field ${i + 1}`);
      sources.push({
        label: model?.name ?? 'Notes',
        columns,
        rows: list.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')),
      });
    }
    // The fullest note type first: it is nearly always the deck itself.
    sources.sort((a, b) => b.rows.length - a.rows.length);
    if (sources.length === 0) throw new AnkiImportError('That package has no notes in it.');
    return sources;
  } finally {
    db.close();
  }
}

const SEPARATORS: Record<string, string> = {
  tab: '\t', comma: ',', semicolon: ';', space: ' ', pipe: '|', colon: ':',
};

/** Split delimited text into rows, honouring "quoted, multi-line" cells. */
export function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let wasQuoted = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
    wasQuoted = false;
  };
  const endRow = () => {
    endCell();
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === '' && !wasQuoted) {
      quoted = true;
      wasQuoted = true;
    } else if (ch === sep) {
      endCell();
    } else if (ch === '\n') {
      endRow();
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

/** Anki's "Notes in Plain Text" and any plain delimited table. */
export function readAnkiText(raw: string): AnkiSource {
  const text = raw.replace(/^\uFEFF/, '');
  const headers: Record<string, string> = {};
  const body: string[] = [];
  let inHeader = true;
  for (const line of text.split('\n')) {
    if (inHeader && line.startsWith('#')) {
      const m = line.replace(/\r$/, '').match(/^#([^:]+):(.*)$/);
      if (m) headers[m[1].trim().toLowerCase()] = m[2];
    } else {
      inHeader = false;
      body.push(line);
    }
  }

  const bodyText = body.join('\n');
  const declared = headers.separator?.trim().toLowerCase();
  let sep = declared ? SEPARATORS[declared] ?? declared : '';
  if (!sep) {
    const first = body.find((l) => l.trim()) ?? '';
    sep = ['\t', ';', ',', '|'].find((s) => first.includes(s)) ?? '\t';
  }

  const rows = parseDelimited(bodyText, sep);
  if (rows.length === 0) throw new AnkiImportError('That file has no notes in it.');

  const width = Math.max(...rows.map((r) => r.length));
  const named = headers.columns ? headers.columns.split(sep) : [];
  const columns = Array.from({ length: width }, (_, i) => named[i]?.trim() || `Column ${i + 1}`);

  // A tags/deck column is metadata, not vocabulary: keep it out of the mapping.
  const meta = new Set<number>();
  for (const key of ['tags column', 'deck column', 'notetype column', 'guid column']) {
    const n = Number(headers[key]);
    if (Number.isInteger(n) && n >= 1 && n <= width) meta.add(n - 1);
  }
  const keep = columns.map((_, i) => i).filter((i) => !meta.has(i));

  return {
    label: 'Notes',
    columns: keep.map((i) => columns[i]),
    rows: rows.map((r) => keep.map((i) => r[i] ?? '')),
  };
}

/** Which source column feeds which part of a Wazn word (index, or null). */
export interface FieldMapping {
  arabic: number | null;
  english: number | null;
  shaami: number | null;
  plural: number | null;
  root: number | null;
  quran: number | null;
  quranEnglish: number | null;
  quranReference: number | null;
}

export const MAPPING_LABELS: { key: keyof FieldMapping; label: string; required?: boolean }[] = [
  { key: 'arabic', label: 'Arabic word', required: true },
  { key: 'english', label: 'English meaning' },
  { key: 'shaami', label: 'Shaami (colloquial)' },
  { key: 'plural', label: 'Plural' },
  { key: 'root', label: 'Root' },
  { key: 'quran', label: 'Qur’an verse' },
  { key: 'quranEnglish', label: 'Verse translation' },
  { key: 'quranReference', label: 'Verse reference' },
];

const NAME_HINTS: Record<keyof FieldMapping, RegExp> = {
  arabic: /^(arabic|fusha|fus'?ha|msa|word|front|term|expression|عربي|الكلمة)$/i,
  english: /^(english|meaning|translation|back|definition|gloss|answer)$/i,
  shaami: /(shaami|shami|levantine|colloquial|dialect|ammiya|عامية|شامي)/i,
  plural: /plural|جمع/i,
  root: /^(root|جذر)$/i,
  quranEnglish: /quran.*(english|translation)|verse.*(english|translation)/i,
  quranReference: /quran.*ref|verse.*ref|^reference$/i,
  quran: /^(quran|qur'?an|verse|ayah|aya)$/i,
};

function columnScore(rows: string[][], col: number, test: (s: string) => boolean): number {
  const sample = rows.slice(0, 50);
  if (sample.length === 0) return 0;
  return sample.filter((r) => test(cleanField(r[col] ?? ''))).length / sample.length;
}

/** A first guess at the mapping, from column names and then from what the columns hold. */
export function guessMapping(source: AnkiSource): FieldMapping {
  const mapping: FieldMapping = {
    arabic: null, english: null, shaami: null, plural: null, root: null,
    quran: null, quranEnglish: null, quranReference: null,
  };
  const taken = new Set<number>();
  const claim = (key: keyof FieldMapping, col: number) => {
    mapping[key] = col;
    taken.add(col);
  };

  // Most specific names first, so "Quran English" is not mistaken for "English".
  const order: (keyof FieldMapping)[] = [
    'quranEnglish', 'quranReference', 'quran', 'shaami', 'plural', 'root', 'arabic', 'english',
  ];
  for (const key of order) {
    const col = source.columns.findIndex((name, i) => !taken.has(i) && NAME_HINTS[key].test(name.trim()));
    if (col >= 0) claim(key, col);
  }

  // What is left, by content: the column that is mostly Arabic is the word,
  // the one that is mostly Latin letters is the meaning.
  const free = source.columns.map((_, i) => i).filter((i) => !taken.has(i));
  if (mapping.arabic === null) {
    const best = free
      .map((i) => ({ i, s: columnScore(source.rows, i, hasArabic) }))
      .filter((c) => c.s >= 0.5)
      .sort((a, b) => b.s - a.s)[0];
    if (best) claim('arabic', best.i);
  }
  if (mapping.english === null) {
    const best = source.columns
      .map((_, i) => i)
      .filter((i) => !taken.has(i))
      .map((i) => ({ i, s: columnScore(source.rows, i, (t) => hasLatin(t) && !hasArabic(t)) }))
      .filter((c) => c.s >= 0.5)
      .sort((a, b) => b.s - a.s)[0];
    if (best) claim('english', best.i);
  }
  return mapping;
}

/** "ك ت ب", "ك.ت.ب" and "ك-ت-ب" are all the same root, written hyphenated. */
export function normaliseRoot(value: string): string | null {
  const letters = cleanField(value).match(/[ء-ي]/g);
  if (!letters || letters.length < 3 || letters.length > 4) return null;
  // Only trust a root that was written as separate letters, or is exactly 3-4 letters.
  return letters.join('-');
}

function arabicRun(text: string): string {
  const runs = text.match(/[؀-ۿݐ-ݿࢠ-ࣿ][؀-ۿݐ-ݿࢠ-ࣿ\s/،ـ]*/g);
  return runs ? runs.join(' ').replace(/\s+/g, ' ').trim() : '';
}

export interface ImportPlan {
  entries: TaggedImportEntry[];
  /** Already in the deck (or earlier in the same file). */
  duplicates: number;
  /** No Arabic text could be found in the row. */
  unreadable: number;
}

/**
 * Turn mapped notes into words.
 *
 * Tolerant in the ways real decks need: a back that holds the Arabic and a
 * front that holds the English is swapped rather than dropped, and a cell
 * that holds both ("كتاب (book)") is split between them.
 */
export function planImport(source: AnkiSource, mapping: FieldMapping, existing: FlashCard[]): ImportPlan {
  const held = new Set(existing.map((c) => wordKey(c.word)));
  const entries: TaggedImportEntry[] = [];
  let duplicates = 0;
  let unreadable = 0;

  const cell = (row: string[], col: number | null) => (col === null ? '' : cleanField(row[col] ?? ''));

  for (const row of source.rows) {
    let ar = cell(row, mapping.arabic);
    let en = cell(row, mapping.english);

    if (!hasArabic(ar) && hasArabic(en)) [ar, en] = [en, ar];
    if (!hasArabic(ar)) {
      unreadable += 1;
      continue;
    }
    if (hasLatin(ar)) {
      const arabicPart = arabicRun(ar);
      const rest = ar.replace(/[؀-ۿݐ-ݿࢠ-ࣿ\s/،ـ]+/g, ' ').replace(/[()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!en && rest) en = rest;
      ar = arabicPart || ar;
    }

    const key = wordKey(ar);
    if (!key || held.has(key)) {
      duplicates += 1;
      continue;
    }
    held.add(key);

    entries.push({
      fusha: ar,
      english: en,
      shaami: cell(row, mapping.shaami) || null,
      fushaPlural: cell(row, mapping.plural) || null,
      shaamiPlural: null,
      root: mapping.root === null ? null : normaliseRoot(cell(row, mapping.root)),
      // Left unset on purpose: the app tags untagged words itself, so an
      // imported word is classified the same way a typed one is.
      wordType: null as unknown as WordType,
      verbForm: null,
      wordVoweled: ar,
      pastTense: null,
      presentTense: null,
      masdarForm: null,
      companionForms: [],
      quranExample: cell(row, mapping.quran) || null,
      quranExampleEn: cell(row, mapping.quranEnglish) || null,
      quranReference: cell(row, mapping.quranReference) || null,
    });
  }
  return { entries, duplicates, unreadable };
}
