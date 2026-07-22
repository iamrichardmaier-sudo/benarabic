// Import path for pre-tagged word datasets. Accepts a JSON array of fully
// tagged entries (as produced by an external tagging pass, e.g. Claude in
// chat), validates the shape strictly, and hands back clean entries ready to
// insert — bypassing the tag-word edge function entirely.

import type { CompanionForm, VerbForm, WordType } from './spaced-repetition';

export interface TaggedImportEntry {
  fusha: string;
  english: string;
  shaami: string | null;
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
    raw = JSON.parse(text);
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
