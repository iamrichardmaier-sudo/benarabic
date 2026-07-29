// Import path for pre-tagged word datasets. Accepts a JSON array of fully
// tagged entries (as produced by an external tagging pass, e.g. Claude in
// chat), validates the shape strictly, and hands back clean entries ready to
// insert — bypassing the tag-word edge function entirely.

import type { CompanionForm, VerbForm, WordType } from './spaced-repetition';

export interface TaggedImportEntry {
  fusha: string;
  english: string;
  shaami: string | null;
  fushaPlural: string | null;
  shaamiPlural: string | null;
  /** Optional override for the Pexels image search; defaults to `english`. */
  imageQuery?: string | null;
  root: string | null;
  wordType: WordType;
  verbForm: VerbForm | null;
  wordVoweled: string;
  pastTense: string | null;
  presentTense: string | null;
  masdarForm: string | null;
  companionForms: CompanionForm[];
}

export interface ImportValidation {
  entries: TaggedImportEntry[];
  errors: string[];
}

/**
 * Copying JSON that contains Arabic out of a chat window or web page routinely
 * introduces characters that are invisible on screen but fatal to JSON.parse:
 * bidirectional control marks placed around RTL runs, non-breaking spaces from
 * HTML rendering, smart quotes from rich-text editors, and a wrapping markdown
 * code fence. Clean all of that up before parsing rather than making the user
 * hunt for an invisible character.
 */
export function sanitizeJsonText(raw: string): string {
  const cleaned = raw
    // Bidi controls, zero-width characters and BOM.
    .replace(/[​-‏؜‪-‮⁦-⁩﻿]/g, '')
    // Every flavour of non-breaking / exotic space becomes a plain space.
    .replace(/[   -   　]/g, ' ')
    // Smart quotes back to the ASCII forms JSON requires.
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'");

  // Ignore anything outside the outermost array, which also drops a markdown
  // code fence or stray prose pasted along with the data.
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end > start) return cleaned.slice(start, end + 1);
  return cleaned.trim();
}

/** True when text is meant as a JSON dataset rather than a plain word list. */
export function looksLikeJson(text: string): boolean {
  const t = sanitizeJsonText(text);
  return t.startsWith('[') && t.includes('"fusha"');
}

const WORD_TYPES: WordType[] = ['verb', 'masdar', 'noun', 'adjective', 'participle', 'other'];
const VERB_FORMS: VerbForm[] = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Parse + validate a pasted JSON dataset. Never throws: all problems are
 * returned as human-readable messages in `errors` (empty errors = safe to
 * import every entry).
 */
export function parseTaggedImport(text: string): ImportValidation {
  const errors: string[] = [];
  const entries: TaggedImportEntry[] = [];

  let raw: unknown;
  try {
    raw = JSON.parse(sanitizeJsonText(text));
  } catch {
    return { entries, errors: ['Not valid JSON. Paste the entire dataset, starting with [ and ending with ].'] };
  }

  if (!Array.isArray(raw)) {
    return { entries, errors: ['Expected a JSON array of word entries (starting with [).'] };
  }
  if (raw.length === 0) {
    return { entries, errors: ['The array is empty — nothing to import.'] };
  }

  raw.forEach((item, i) => {
    const at = `Entry ${i + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${at}: must be an object.`);
      return;
    }
    const o = item as Record<string, unknown>;

    const fusha = optionalString(o.fusha);
    if (!fusha) {
      errors.push(`${at}: "fusha" is required and must be a non-empty string.`);
      return;
    }

    const english = optionalString(o.english);
    if (!english) {
      errors.push(`${at} (${fusha}): "english" is required — it's the card back and the image search query.`);
      return;
    }

    const wordTypeRaw = optionalString(o.wordType) ?? 'other';
    if (!WORD_TYPES.includes(wordTypeRaw as WordType)) {
      errors.push(`${at} (${fusha}): "wordType" must be one of ${WORD_TYPES.join(', ')} — got "${wordTypeRaw}".`);
      return;
    }

    const verbFormRaw = optionalString(o.verbForm);
    if (verbFormRaw && !VERB_FORMS.includes(verbFormRaw as VerbForm)) {
      errors.push(`${at} (${fusha}): "verbForm" must be a Roman numeral I–X or null — got "${verbFormRaw}".`);
      return;
    }

    let companionForms: CompanionForm[] = [];
    if (o.companionForms !== undefined && o.companionForms !== null) {
      if (!Array.isArray(o.companionForms)) {
        errors.push(`${at} (${fusha}): "companionForms" must be an array of {form, label} objects.`);
        return;
      }
      const bad = (o.companionForms as unknown[]).findIndex(
        (c) => !c || typeof c !== 'object'
          || typeof (c as Record<string, unknown>).form !== 'string'
          || typeof (c as Record<string, unknown>).label !== 'string',
      );
      if (bad !== -1) {
        errors.push(`${at} (${fusha}): companionForms[${bad}] must have string "form" and "label".`);
        return;
      }
      companionForms = (o.companionForms as CompanionForm[]).slice(0, 4);
    }

    entries.push({
      fusha,
      english,
      shaami: optionalString(o.shaami),
      fushaPlural: optionalString(o.fushaPlural),
      shaamiPlural: optionalString(o.shaamiPlural),
      imageQuery: optionalString(o.imageQuery),
      root: optionalString(o.root),
      wordType: wordTypeRaw as WordType,
      verbForm: (verbFormRaw as VerbForm) ?? null,
      wordVoweled: optionalString(o.wordVoweled) ?? fusha,
      pastTense: optionalString(o.pastTense),
      presentTense: optionalString(o.presentTense),
      masdarForm: optionalString(o.masdarForm),
      companionForms,
    });
  });

  return { entries, errors };
}
