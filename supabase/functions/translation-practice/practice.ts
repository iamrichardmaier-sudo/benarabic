/**
 * The model-free half of daily translation practice: the prompts, the shapes
 * the model must answer in, and everything done to its answers before a
 * learner sees them. Kept apart from index.ts so it can be tested without a
 * network or a database.
 *
 * Three things keep the feedback honest:
 *   1. An attempt that matches a stored correct translation (ignoring vowels
 *      and spelling variants) is marked correct without asking the model, so
 *      it can never "fix" an answer that was already right.
 *   2. The grader is given several correct translations to compare against,
 *      and must name a rule for every correction or call it an alternative.
 *   3. A second, independent pass re-checks each correction; any the checker
 *      does not confirm is shown as an acceptable alternative, not an error.
 */

export interface RecentWord {
  word: string;
  english: string | null;
  word_type: string | null;
}

export interface Challenge {
  english: string;
  grammar_focus: string;
  target_words: string[];
  reference_translations: string[];
  pitfalls: string[];
}

export type WordStatus = "ok" | "fix" | "add" | "remove" | "alternative";
export type Verdict = "correct" | "minor" | "errors" | "meaning";

export interface WordNote {
  yours: string;
  correct: string;
  status: WordStatus;
  rule: string;
  note: string;
}

export interface Feedback {
  verdict: Verdict;
  summary: string;
  /** The correct sentence that stays closest to what the learner wrote. */
  closest_correct: string;
  /** The stored reference translation nearest the attempt. */
  closest_reference: string;
  words: WordNote[];
  tips: string[];
  /** Whether the second pass ran and confirmed or cleared every correction. */
  verified: boolean;
  /** True when the attempt matched a reference and no model was asked. */
  exact_match?: boolean;
}

/* ---------------------------------------------------------------- matching */

/** Vowels, tatweel and the spelling variants nobody should be marked down for. */
export function normalize(s: string): string {
  return s
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[.,!?؟،؛:;"'«»()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  const n = normalize(s);
  return n ? n.split(" ") : [];
}

/** Dice overlap of the two sentences' words, 0–1. */
export function similarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const t of tb) pool.set(t, (pool.get(t) ?? 0) + 1);
  let shared = 0;
  for (const t of ta) {
    const left = pool.get(t) ?? 0;
    if (left > 0) {
      shared++;
      pool.set(t, left - 1);
    }
  }
  return (2 * shared) / (ta.length + tb.length);
}

/** The reference nearest the attempt, or "" when there are none. */
export function closestReference(attempt: string, references: string[]): string {
  let best = "";
  let bestScore = -1;
  for (const r of references) {
    const score = similarity(attempt, r);
    if (score > bestScore) {
      best = r;
      bestScore = score;
    }
  }
  return best;
}

/** Feedback for an attempt identical to a reference, built without a model. */
export function exactMatchFeedback(attempt: string, references: string[]): Feedback | null {
  const n = normalize(attempt);
  const hit = references.find((r) => normalize(r) === n);
  if (!hit) return null;
  return {
    verdict: "correct",
    summary: "Exactly right — this matches one of the correct translations.",
    closest_correct: hit,
    closest_reference: hit,
    words: attempt.trim().split(/\s+/).map((w) => ({ yours: w, correct: w, status: "ok", rule: "", note: "" })),
    tips: [],
    verified: true,
    exact_match: true,
  };
}

/* ------------------------------------------------------------- generation */

/**
 * The rules most often broken lately, most frequent first, so tomorrow's
 * sentences can aim at them.
 */
export function weakSpots(pastFeedback: Feedback[], limit = 5): string[] {
  const counts = new Map<string, number>();
  for (const f of pastFeedback) {
    for (const w of f.words ?? []) {
      if (!isCorrection(w.status) || !w.rule) continue;
      const rule = w.rule.trim();
      counts.set(rule, (counts.get(rule) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([rule]) => rule);
}

export const CHALLENGE_SYSTEM = `You are an expert teacher of Modern Standard Arabic (فصحى) writing translation exercises for an advanced learner.

Write English sentences that are genuinely hard to translate into Arabic: complex grammar, natural modern English, 14–28 words each. Every Arabic translation you give must be correct, natural Modern Standard Arabic — never dialect. Check each one for agreement (gender, number, definiteness), case after particles and verbs, the right verb form and preposition, and number rules.`;

export function buildChallengePrompt(words: RecentWord[], weak: string[]): string {
  const list = words
    .map((w) => `- ${w.word}${w.english ? ` (${w.english})` : ""}${w.word_type ? ` [${w.word_type}]` : ""}`)
    .join("\n");
  const weakLine = weak.length > 0
    ? `\nThe learner has recently got these wrong; make at least one sentence test one of them:\n${weak.map((r) => `- ${r}`).join("\n")}\n`
    : "";
  return `The learner's most recently added words, newest first:
${list || "- (none yet — use common, useful modern vocabulary)"}
${weakLine}
Write exactly 3 English sentences for the learner to translate into Arabic.
- Each sentence uses 2–4 of the learner's words above (prefer the newest), listed in target_words exactly as written above.
- Each tests a different hard structure, named in grammar_focus. Draw from: counterfactual لو / لولا, كان + present (past habit), passive voice, relative clauses (الذي/التي/ما/مَن) including ones with a resumptive pronoun, حال clauses, إنّ / أنّ / لكنّ and their sisters, كاد / ما زال / لم يعد, the absolute object (مفعول مطلق), exception (إلا / غير / سوى), comparatives and superlatives, numbers with counted nouns, لم / لن / لا negation, conditionals with إذا / إن, idafa chains, verbal nouns in place of أن + verb.
- reference_translations: 6 to 8 different correct Arabic translations of the same sentence, varying word order (verbal vs nominal sentence), synonyms and construction, so that many valid ways of saying it are covered. Write them without vowel marks.
- pitfalls: 2–4 short notes on mistakes a learner is likely to make on this sentence, each naming the rule.`;
}

export const CHALLENGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    sentences: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          english: { type: "STRING" },
          grammar_focus: { type: "STRING" },
          target_words: { type: "ARRAY", items: { type: "STRING" } },
          reference_translations: { type: "ARRAY", items: { type: "STRING" } },
          pitfalls: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["english", "grammar_focus", "target_words", "reference_translations", "pitfalls"],
      },
    },
  },
  required: ["sentences"],
};

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim()) : [];

/** The model's three sentences, checked; throws if it did not give three usable ones. */
export function parseChallenges(raw: unknown): Challenge[] {
  const list = (raw as { sentences?: unknown })?.sentences;
  if (!Array.isArray(list)) throw new Error("The model gave no sentences");
  const out: Challenge[] = [];
  for (const item of list) {
    const s = item as Record<string, unknown>;
    const english = typeof s.english === "string" ? s.english.trim() : "";
    const refs = [...new Set(strings(s.reference_translations))];
    if (!english || refs.length === 0) continue;
    out.push({
      english,
      grammar_focus: typeof s.grammar_focus === "string" ? s.grammar_focus.trim() : "",
      target_words: strings(s.target_words),
      reference_translations: refs,
      pitfalls: strings(s.pitfalls),
    });
    if (out.length === 3) break;
  }
  if (out.length < 3) throw new Error("The model gave fewer than 3 usable sentences");
  return out;
}

/* ---------------------------------------------------------------- grading */

export const GRADE_SYSTEM = `You are a meticulous, fair examiner of Modern Standard Arabic (فصحى) translation.

There are many correct ways to translate a sentence. Your job is NOT to make the learner's answer match a reference — it is to find the smallest set of changes that makes THE LEARNER'S OWN sentence correct, keeping their word choices and structure wherever they are valid.

Rules you must follow:
- Only mark something as an error if it breaks a specific rule of Modern Standard Arabic grammar, or changes the meaning of the English. Name that rule.
- If a word or construction is valid but differs from the references, mark it "alternative" (or "ok"), never "fix".
- Do not mark missing or different vowel marks (tashkeel) as errors unless they change which word it is.
- Do not penalise spelling variants: أ/إ/ا, ة/ه, ى/ي.
- When unsure whether something is wrong, do not call it wrong.`;

export function buildGradePrompt(challenge: Challenge, attempt: string, nearest: string): string {
  return `English sentence: ${challenge.english}
Grammar being tested: ${challenge.grammar_focus || "general"}

Correct translations (there are others too):
${challenge.reference_translations.map((r) => `- ${r}`).join("\n")}

The closest of these to the learner's attempt: ${nearest}

Mistakes learners often make here:
${challenge.pitfalls.map((p) => `- ${p}`).join("\n") || "- (none listed)"}

Learner's attempt: ${attempt}

Grade the attempt.
- verdict: "correct" (no errors), "minor" (only small errors), "errors" (real grammar errors), or "meaning" (it does not say what the English says).
- closest_correct: the learner's sentence with only the necessary corrections made, written with vowel marks on the corrected words. If it is already correct, repeat it.
- words: go through the learner's sentence word by word, in order. For each word: yours (exactly as they wrote it), correct (what it should be, or the same word), status ("ok", "fix" = wrong form/word, "remove" = should not be there, "alternative" = valid but different from the references), rule (the grammar rule, required for fix/remove), note (one short sentence in English explaining it to the learner). Add an entry with status "add" and yours "" for each word that is missing, at the place it belongs.
- summary: one or two encouraging sentences on how it went overall.
- tips: up to 3 short, specific tips for this learner based on this attempt.`;
}

export const GRADE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["correct", "minor", "errors", "meaning"] },
    summary: { type: "STRING" },
    closest_correct: { type: "STRING" },
    words: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          yours: { type: "STRING" },
          correct: { type: "STRING" },
          status: { type: "STRING", enum: ["ok", "fix", "add", "remove", "alternative"] },
          rule: { type: "STRING" },
          note: { type: "STRING" },
        },
        required: ["yours", "correct", "status", "rule", "note"],
      },
    },
    tips: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["verdict", "summary", "closest_correct", "words", "tips"],
};

const STATUSES: WordStatus[] = ["ok", "fix", "add", "remove", "alternative"];
const VERDICTS: Verdict[] = ["correct", "minor", "errors", "meaning"];

export function isCorrection(status: WordStatus): boolean {
  return status === "fix" || status === "add" || status === "remove";
}

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The grader's answer, cleaned up into Feedback (not yet verified). */
export function parseGrade(raw: unknown, nearest: string): Feedback {
  const r = (raw ?? {}) as Record<string, unknown>;
  const words: WordNote[] = (Array.isArray(r.words) ? r.words : []).map((w) => {
    const o = (w ?? {}) as Record<string, unknown>;
    const status = STATUSES.includes(o.status as WordStatus) ? (o.status as WordStatus) : "ok";
    const yours = text(o.yours);
    const correct = text(o.correct);
    const rule = text(o.rule);
    // A "fix" that changes nothing, or names no rule, is not a correction.
    const hollow = status === "fix" && (normalize(yours) === normalize(correct) || !rule);
    return { yours, correct, status: hollow ? "alternative" : status, rule, note: text(o.note) };
  }).filter((w) => w.yours !== "" || w.correct !== "");
  const verdict = VERDICTS.includes(r.verdict as Verdict) ? (r.verdict as Verdict) : "errors";
  return settleVerdict({
    verdict,
    summary: text(r.summary),
    closest_correct: text(r.closest_correct),
    closest_reference: nearest,
    words,
    tips: strings(r.tips).slice(0, 3),
    verified: false,
  });
}

/**
 * A verdict that agrees with the word list: "correct" can carry no
 * corrections, and a list with none left cannot be "errors" or "minor".
 * "meaning" stands, since it is about the whole sentence, not one word.
 */
export function settleVerdict(f: Feedback): Feedback {
  const corrections = f.words.filter((w) => isCorrection(w.status)).length;
  if (f.verdict === "meaning") return f;
  if (corrections === 0) return { ...f, verdict: "correct" };
  if (f.verdict === "correct") return { ...f, verdict: corrections <= 1 ? "minor" : "errors" };
  return f;
}

/* ------------------------------------------------------------ verification */

export const VERIFY_SYSTEM = `You are a second, independent examiner of Modern Standard Arabic. Another examiner has flagged corrections in a learner's translation. For each one, decide whether the learner's original really is WRONG in Modern Standard Arabic (or really changes the meaning). A correction is only confirmed if the original breaks a real rule; a different-but-valid choice, a stylistic preference, or a vowel-mark difference is NOT wrong. Be strict about this.`;

export function buildVerifyPrompt(english: string, attempt: string, f: Feedback): string {
  const items = f.words
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => isCorrection(w.status))
    .map(({ w, i }) =>
      `#${i}: ${w.status === "add" ? `add "${w.correct}"` : w.status === "remove" ? `remove "${w.yours}"` : `"${w.yours}" → "${w.correct}"`} — claimed rule: ${w.rule || "(none given)"}`
    );
  return `English sentence: ${english}
Learner's translation: ${attempt}

Corrections to check:
${items.join("\n")}

For each correction, answer with its number, confirmed (true only if the learner's original is really wrong), and a one-sentence reason.`;
}

export const VERIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    checks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          confirmed: { type: "BOOLEAN" },
          reason: { type: "STRING" },
        },
        required: ["index", "confirmed", "reason"],
      },
    },
  },
  required: ["checks"],
};

/**
 * Applies the second examiner's checks. A correction it did not confirm — or
 * did not mention at all — is not shown as an error.
 */
export function applyVerification(f: Feedback, raw: unknown): Feedback {
  const checks = (raw as { checks?: unknown })?.checks;
  const byIndex = new Map<number, { confirmed: boolean; reason: string }>();
  if (Array.isArray(checks)) {
    for (const c of checks) {
      const o = (c ?? {}) as Record<string, unknown>;
      if (typeof o.index !== "number") continue;
      byIndex.set(o.index, { confirmed: o.confirmed === true, reason: text(o.reason) });
    }
  }
  const words = f.words.flatMap((w, i): WordNote[] => {
    if (!isCorrection(w.status)) return [w];
    const check = byIndex.get(i);
    if (check?.confirmed) return [w];
    // An unconfirmed "add" was never in the learner's sentence: drop it.
    if (w.status === "add") return [];
    return [{
      ...w,
      correct: w.yours,
      status: "alternative",
      note: check?.reason
        ? `Fine as you wrote it — ${check.reason}`
        : "Fine as you wrote it; the suggested change was not confirmed on a second check.",
    }];
  });
  const demoted = words.length !== f.words.length || words.some((w, i) => w !== f.words[i]);
  return settleVerdict({
    ...f,
    words,
    // The grader's corrected sentence still carries any withdrawn changes, so
    // it is rebuilt from the words that survived.
    closest_correct: demoted ? rebuild(words) : f.closest_correct,
    verified: true,
  });
}

/** The learner's sentence with only the surviving corrections applied. */
export function rebuild(words: WordNote[]): string {
  return words
    .filter((w) => w.status !== "remove")
    .map((w) => (w.status === "alternative" ? w.yours : w.correct || w.yours))
    .filter(Boolean)
    .join(" ");
}
