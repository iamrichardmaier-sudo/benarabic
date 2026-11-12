import type { FlashCard } from './spaced-repetition';
import { isoDay } from './day';

/**
 * Taking the words out of the deck as a document, for a person or for an AI.
 *
 * This file is the part with no PDF and no browser in it: which cards are
 * included, what is said about each one, and the Markdown version. The PDF
 * (deck-export-pdf.ts) is built from the same `describeCard`, so the two
 * formats can never disagree about a word.
 */

export type ExportRange = 'recent' | 'all';
export type ExportFormat = 'pdf' | 'markdown';

/** "The last 2 weeks" is fourteen days back from now. */
export const RECENT_DAYS = 14;

export const RANGE_LABEL: Record<ExportRange, string> = {
  recent: 'last 2 weeks',
  all: 'entire deck',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** The first moment that counts as "recent". */
export function recentCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - RECENT_DAYS * DAY_MS);
}

/**
 * The cards to export, newest first.
 *
 * A card with no (or an unreadable) added-date is never "recent": it can't be
 * shown to belong to the last two weeks, and quietly including it would put
 * old words in a list that claims to be new ones. The entire deck has them all.
 */
export function selectCards(cards: FlashCard[], range: ExportRange, now: Date = new Date()): FlashCard[] {
  const added = (c: FlashCard) => {
    const t = c.createdAt ? Date.parse(c.createdAt) : NaN;
    return Number.isNaN(t) ? null : t;
  };
  const cutoff = recentCutoff(now).getTime();
  const picked = range === 'all'
    ? cards.slice()
    : cards.filter((c) => {
        const t = added(c);
        return t !== null && t >= cutoff && t <= now.getTime() + DAY_MS;
      });
  // Stable for equal dates, and cards with no date sink to the bottom.
  return picked
    .map((c, i) => ({ c, i, t: added(c) ?? -Infinity }))
    .sort((a, b) => b.t - a.t || a.i - b.i)
    .map((x) => x.c);
}

// -- What is said about one card ---------------------------------------------

export interface EntryParts {
  /** The Arabic word, with vowel marks when the deck has them. */
  arabic: string;
  english: string;
  /** "verb, form II", "noun" — null when the card was never tagged. */
  type: string | null;
  gender: 'masculine' | 'feminine' | null;
  /** The named batch the card belongs to, e.g. "Chapter IV: Celebrations". */
  group: string | null;
  status: 'new' | 'learning' | 'learned' | null;
  /** "12 Oct 2026". */
  added: string | null;
  /** Labelled Arabic values: root, plural, the verb's tenses and so on. */
  facts: { label: string; value: string }[];
  /** A sentence using the word, with its translation. */
  sentence: { ar: string; en: string | null } | null;
  quran: { ar: string; en: string | null; ref: string | null } | null;
}

const clean = (s: string | null | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

const TYPE_LABEL: Record<string, string> = {
  verb: 'verb', masdar: 'verbal noun', noun: 'noun', adjective: 'adjective',
  participle: 'participle', other: 'other', sentence: 'sentence',
};

const STATUS_LABEL: Record<string, string> = {
  new: 'new',
  stage1: 'learning',
  stage2: 'learning',
  graduated: 'learned',
};

/** "12 Oct 2026", in English whatever the device's language. */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function describeCard(card: FlashCard): EntryParts {
  const type = card.wordType && TYPE_LABEL[card.wordType]
    ? (card.wordType === 'verb' && card.verbForm ? `verb, form ${card.verbForm}` : TYPE_LABEL[card.wordType])
    : null;
  const gender = card.gender === 'm' ? 'masculine' : card.gender === 'f' ? 'feminine' : null;
  const status = (STATUS_LABEL[card.learningStage] ?? null) as EntryParts['status'];

  const facts: EntryParts['facts'] = [];
  const add = (label: string, value: string | null | undefined) => {
    const v = clean(value);
    if (v) facts.push({ label, value: v });
  };
  add('Root', card.root);
  add('Plural', card.fushaPlural);
  add('Past', card.pastTense);
  add('Present', card.presentTense);
  add('Verbal noun', card.masdarForm);
  add('Takes', card.fixedPreposition);
  add('Shaami', card.shaami);
  add('Shaami plural', card.shaamiPlural);
  for (const f of card.companionForms ?? []) add(clean(f.label) || 'Related', f.form);

  // The stored sentence has "___" where the preposition goes; show it filled in,
  // the way the translation already is.
  const prep = clean(card.fixedPreposition);
  const sentenceAr = clean(card.prepositionSentence);
  const sentence = sentenceAr
    ? { ar: prep ? sentenceAr.replace(/_{2,}/g, prep) : sentenceAr, en: clean(card.prepositionSentenceEn) || null }
    : null;

  const quranAr = clean(card.quranExample);
  const quran = quranAr
    ? { ar: quranAr, en: clean(card.quranExampleEn) || null, ref: clean(card.quranReference) || null }
    : null;

  return {
    arabic: clean(card.wordVoweled) || clean(card.word),
    english: clean(card.english),
    type,
    gender,
    group: clean(card.group) || null,
    status,
    added: shortDate(card.createdAt),
    facts,
    sentence,
    quran,
  };
}

/** The grey one-liner under a word in the PDF. */
export function metaLine(p: EntryParts): string {
  return [p.type, p.gender, p.group, p.status, p.added ? `added ${p.added}` : null]
    .filter((x): x is string => !!x)
    .join(' · ');
}

// -- Markdown, for an AI -----------------------------------------------------

/** Headline numbers a reader (or a model) wants before the first word. */
export interface ExportHeader {
  range: ExportRange;
  count: number;
  now: Date;
}

/**
 * The deck as Markdown: plain headings and "- **Field:** value" lines, which is
 * as easy as text gets for a model to read, split and quote back, and which
 * also reads fine to a person. Every field a card has is in it; fields a card
 * lacks are left out rather than written as blanks.
 */
export function buildMarkdown(cards: FlashCard[], header: ExportHeader): string {
  const { range, count, now } = header;
  const lines: string[] = [];
  lines.push('# Arabic vocabulary (Wazn export)');
  lines.push('');
  lines.push(`- **Exported:** ${isoDay(now)}`);
  lines.push(
    range === 'recent'
      ? `- **Range:** words added in the last ${RECENT_DAYS} days (since ${isoDay(recentCutoff(now))})`
      : '- **Range:** the entire deck',
  );
  lines.push(`- **Words:** ${count}`);
  lines.push('- **Order:** newest first');
  lines.push(
    '- **Notes for the reader:** The learner is studying Modern Standard Arabic (Fusha). ' +
      '"Shaami" marks a Levantine dialect equivalent. Vowel marks are included where the learner has them. ' +
      'A field is left out when it is not known. "Status" is how far the learner has got with the word: ' +
      'new, learning or learned.',
  );
  lines.push('');

  cards.forEach((card, i) => {
    const p = describeCard(card);
    lines.push(`## ${i + 1}. ${p.arabic}`);
    lines.push('');
    if (p.english) lines.push(`- **English:** ${p.english}`);
    if (p.type) lines.push(`- **Type:** ${p.type}`);
    if (p.gender) lines.push(`- **Gender:** ${p.gender}`);
    if (p.group) lines.push(`- **Group:** ${p.group}`);
    if (p.status) lines.push(`- **Status:** ${p.status}`);
    if (p.added) lines.push(`- **Added:** ${p.added}`);
    for (const f of p.facts) lines.push(`- **${f.label}:** ${f.value}`);
    if (p.sentence) {
      lines.push(`- **Example:** ${p.sentence.ar}`);
      if (p.sentence.en) lines.push(`  - *${p.sentence.en}*`);
    }
    if (p.quran) {
      lines.push(`- **Qur'an:** ${p.quran.ar}${p.quran.ref ? ` (${p.quran.ref})` : ''}`);
      if (p.quran.en) lines.push(`  - *${p.quran.en}*`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

// -- Files -------------------------------------------------------------------

/** wazn-words-2026-11-03-last-2-weeks.pdf */
export function exportFilename(range: ExportRange, format: ExportFormat, now: Date = new Date()): string {
  const slug = range === 'recent' ? 'last-2-weeks' : 'entire-deck';
  return `wazn-words-${isoDay(now)}-${slug}.${format === 'pdf' ? 'pdf' : 'md'}`;
}

/** Hands a file to the browser as a download. */
export function downloadFile(data: BlobPart, filename: string, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
