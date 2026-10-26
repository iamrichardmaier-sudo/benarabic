/**
 * The prompt, output schema and validation for enrich-words. Kept free of
 * Deno and network imports so it can be tested on its own.
 */

/** A saved word waiting for enrichment, with whatever is already known. */
export interface PendingWord {
  word: string;
  english: string | null;
  shaami: string | null;
  root: string | null;
  word_type: string | null;
  verb_form: string | null;
  gender: string | null;
}

export const WORD_TYPES = ["verb", "masdar", "noun", "adjective", "participle", "other", "sentence"] as const;
const VERB_FORMS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export const SYSTEM_PROMPT = `You are an expert teacher of Arabic — Modern Standard Arabic (Fusha) and Levantine colloquial (Shaami: Syrian, Lebanese, Palestinian, Jordanian) — with the lexical knowledge of the Hans Wehr dictionary. You are filling in a learner's flashcards so that every saved word has a complete, accurate entry.

For each input item you receive its id, the saved word, and any details the learner already has (english meaning, shaami equivalent, root, word type, verb form, gender). Treat those details as the sense the learner saved: build everything around that meaning, and do not contradict them. Fill in everything else.

Return for each item:
- id: echo the input id exactly.
- english: a short English meaning (two to six words; infinitive for verbs, e.g. "to write"). If the learner gave one, repeat it.
- wordVoweled: the word fully voweled (tashkeel) in its most common reading.
- root: root letters joined by "-" (e.g. "ك-ت-ب"), or "" for particles, loanwords and anything with no derivable root.
- wordType: one of verb, masdar, noun, adjective, participle, other, sentence. Use "sentence" only when the saved item is a phrase or sentence rather than a single word.
- verbForm: Roman numeral I–X if the word is a verb or derives from one specific verb form, else "".
- pastTense, presentTense, masdarForm: fully voweled 3rd-person masculine singular past, present (indicative) and verbal noun, only for a verb or a word tied to one verb; else "".
- gender: for a noun only, "m" or "f" by the word's grammatical gender (أُمّ، أَرض، شَمس، يَد are feminine); else "".
- fushaPlural: for a noun only, the fully voweled plural (broken plural where the word takes one), no article; "" for non-nouns and nouns with no normal plural.
- shaami: the everyday Levantine equivalent of the word, as a Levantine speaker would actually say it, in Arabic script (e.g. Fusha أريد → بدّي, ماذا → شو, الآن → هلّق, سيارة → سيارة). If Levantine simply uses the same word, give that word. For a sentence, give "".
- shaamiPlural: the Levantine plural of the shaami equivalent if it is a noun and differs or is commonly used; else "".
- fushaSentence: one natural Modern Standard Arabic sentence, fully voweled, 6–14 words, that uses the saved word itself in the sense above, in a relevant, everyday or culturally meaningful context — a sentence a learner would genuinely benefit from, not a dictionary-style definition and not a contrived one. Inflect the word as grammar requires.
- fushaSentenceEn: a faithful, natural English translation of fushaSentence.
- shaamiSentence: one natural Levantine colloquial sentence, 5–14 words, in Arabic script, that uses the shaami equivalent (not the Fusha word, unless Levantine uses the same word) the way people really speak — colloquial grammar and vocabulary throughout (بدّي، عم، رح، هيك، شو، ليش، كتير، منيح…), not Fusha with a few dialect words. Add vowel marks only where they help a learner read it.
- shaamiSentenceEn: a faithful, natural English translation of shaamiSentence.
- rootFamily: 3 to 8 other COMMON words built on the same root that a learner would meet in real use — other verb forms, verbal nouns, participles, nouns of place or instrument, related adjectives — each with "word" (fully voweled), "english" (short meaning) and "type" (short grammatical label, e.g. "Form II verb", "Active participle", "Noun of place", "Plural noun"). Do not include the saved word itself, do not invent rare or contrived forms, and return fewer than 3 only if the root genuinely has fewer common relatives. Return [] when there is no root.

When the saved item is a sentence or phrase (wordType "sentence"): fushaSentence is the item rendered in natural Fusha (fully voweled), shaamiSentence is it rendered in natural Levantine, english is its translation, and root, verb fields, gender, plurals, shaami and rootFamily are empty.

Accuracy matters more than anything else: every Arabic form, vowel and meaning must be correct and in real use. Return exactly one result per input item.`;

const FAMILY_ITEM = {
  type: "object",
  properties: {
    word: { type: "string" },
    english: { type: "string" },
    type: { type: "string" },
  },
  required: ["word", "english", "type"],
  additionalProperties: false,
};

const STRING_FIELDS = [
  "english", "wordVoweled", "root", "verbForm", "pastTense", "presentTense", "masdarForm",
  "gender", "fushaPlural", "shaami", "shaamiPlural",
  "fushaSentence", "fushaSentenceEn", "shaamiSentence", "shaamiSentenceEn",
] as const;

export const RESULT_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          wordType: { type: "string", enum: [...WORD_TYPES] },
          ...Object.fromEntries(STRING_FIELDS.map((f) => [f, { type: "string" }])),
          rootFamily: { type: "array", items: FAMILY_ITEM },
        },
        required: ["id", "wordType", ...STRING_FIELDS, "rootFamily"],
        additionalProperties: false,
      },
    },
  },
  required: ["results"],
  additionalProperties: false,
};

/** The user message: each pending word with a short id and what is already known. */
export function buildInput(words: PendingWord[]): string {
  return JSON.stringify(
    words.map((w, i) => {
      const known: Record<string, string> = {};
      if (w.english) known.english = w.english;
      if (w.shaami) known.shaami = w.shaami;
      if (w.root) known.root = w.root;
      if (w.word_type) known.wordType = w.word_type;
      if (w.verb_form) known.verbForm = w.verb_form;
      if (w.gender) known.gender = w.gender;
      return { id: `w${i + 1}`, word: w.word, ...known };
    }),
  );
}

/** The columns apply_word_enrichment fills, in snake_case, for one word. */
export interface Enrichment {
  english: string;
  word_voweled: string;
  root: string;
  word_type: string;
  verb_form: string;
  past_tense: string;
  present_tense: string;
  masdar_form: string;
  gender: string;
  fusha_plural: string;
  shaami: string;
  shaami_plural: string;
  fusha_sentence: string;
  fusha_sentence_en: string;
  shaami_sentence: string;
  shaami_sentence_en: string;
  root_family: { word: string; english: string; type: string }[];
  /** The same family in the shape the app already shows under a word. */
  companion_forms: { form: string; label: string }[];
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const ARABIC = /[؀-ۿ]/;

/**
 * One model result checked and turned into columns, or a reason it was
 * rejected. Fields that do not belong to the word's type are blanked rather
 * than stored, the same way tag-word drops a verb's "plural".
 */
export function toEnrichment(raw: unknown, saved: PendingWord): Enrichment | string {
  if (!raw || typeof raw !== "object") return "result is not an object";
  const r = raw as Record<string, unknown>;
  const wordType = (WORD_TYPES as readonly string[]).includes(r.wordType as string)
    ? (r.wordType as string)
    : "other";
  const fushaSentence = str(r.fushaSentence);
  const shaamiSentence = str(r.shaamiSentence);
  if (!ARABIC.test(fushaSentence)) return "no Fusha sentence";
  if (!ARABIC.test(shaamiSentence)) return "no Shaami sentence";
  if (!str(r.fushaSentenceEn) || !str(r.shaamiSentenceEn)) return "missing a sentence translation";

  const isNoun = wordType === "noun";
  const isSentence = wordType === "sentence";
  const verbForm = str(r.verbForm).toUpperCase();
  const family = isSentence || !Array.isArray(r.rootFamily) ? [] : (r.rootFamily as unknown[])
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({ word: str(f.word), english: str(f.english), type: str(f.type) }))
    .filter((f) => ARABIC.test(f.word) && f.english && f.word !== saved.word)
    .slice(0, 8);

  return {
    english: str(r.english),
    word_voweled: str(r.wordVoweled),
    root: isSentence ? "" : str(r.root),
    word_type: wordType,
    verb_form: VERB_FORMS.includes(verbForm) ? verbForm : "",
    past_tense: isSentence ? "" : str(r.pastTense),
    present_tense: isSentence ? "" : str(r.presentTense),
    masdar_form: isSentence ? "" : str(r.masdarForm),
    gender: isNoun && (r.gender === "m" || r.gender === "f") ? r.gender : "",
    fusha_plural: isNoun ? str(r.fushaPlural) : "",
    shaami: isSentence ? "" : str(r.shaami),
    shaami_plural: isNoun ? str(r.shaamiPlural) : "",
    fusha_sentence: fushaSentence,
    fusha_sentence_en: str(r.fushaSentenceEn),
    shaami_sentence: shaamiSentence,
    shaami_sentence_en: str(r.shaamiSentenceEn),
    root_family: family,
    companion_forms: family.slice(0, 4).map((f) => ({ form: f.word, label: `${f.type} — ${f.english}` })),
  };
}

/** Matches the model's results back to the batch by id. */
export function matchResults(
  words: PendingWord[],
  results: unknown[],
): { word: PendingWord; outcome: Enrichment | string }[] {
  const byId = new Map<string, unknown>();
  for (const r of results) {
    const id = r && typeof r === "object" ? (r as Record<string, unknown>).id : null;
    if (typeof id === "string" && !byId.has(id)) byId.set(id, r);
  }
  return words.map((word, i) => {
    const raw = byId.get(`w${i + 1}`);
    return { word, outcome: raw === undefined ? "no result returned" : toEnrichment(raw, word) };
  });
}
