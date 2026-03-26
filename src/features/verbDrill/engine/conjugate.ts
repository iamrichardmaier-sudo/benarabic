import { ArabicVerb, ConjugationResult, Mood, PronounKey, Tense } from "./types";
import { PRONOUNS, PRONOUN_ORDER } from "./pronouns";
import { getPresentStem } from "./stemPatterns";
import { adjustWeakPresentStem } from "./weakVerbHandler";

export function conjugatePast(verb: ArabicVerb, pronounKey: PronounKey): string {
  const p = PRONOUNS[pronounKey];
  return verb.base + p.suffixPast;
}

export function conjugatePresent(
  verb: ArabicVerb,
  pronounKey: PronounKey,
  mood: Mood = "indicative"
): string {
  const p = PRONOUNS[pronounKey];
  let stem = getPresentStem(verb);
  stem = adjustWeakPresentStem(stem, verb);

  const suffix = p.suffixPresent[mood];
  const longSuffixes = ["ونَ", "وا", "ينَ", "ي", "انِ", "ا", "نَ"];
  const needsDropFinalVowel = longSuffixes.includes(suffix);

  if (!suffix) {
    return p.prefixPresent + stem + (mood === "indicative" ? "ُ" : mood === "subjunctive" ? "َ" : "");
  }

  if (needsDropFinalVowel) {
    return p.prefixPresent + stem + suffix;
  }

  return p.prefixPresent + stem + suffix;
}

export function conjugateFuture(verb: ArabicVerb, pronounKey: PronounKey): string {
  return "سَ" + conjugatePresent(verb, pronounKey, "indicative");
}

export function conjugateImperative(verb: ArabicVerb, pronounKey: PronounKey): string {
  const validImperative: PronounKey[] = ["anta", "anti", "antuma", "antum", "antunna"];
  if (!validImperative.includes(pronounKey)) return "—";

  const p = PRONOUNS[pronounKey];
  const jussiveStem = getPresentStem(verb);
  const adjusted = adjustWeakPresentStem(jussiveStem, verb);
  const needsAlif = !["ا", "أ", "إ"].includes(adjusted[0]);

  return (needsAlif ? "اُ" : "") + adjusted + p.suffixImperative;
}

export function getConjugation(
  verb: ArabicVerb,
  pronounKey: PronounKey,
  tense: Tense,
  mood: Mood = "indicative"
): ConjugationResult {
  let form = "";

  if (tense === "past") form = conjugatePast(verb, pronounKey);
  else if (tense === "present") form = conjugatePresent(verb, pronounKey, mood);
  else if (tense === "future") form = conjugateFuture(verb, pronounKey);
  else if (tense === "imperative") form = conjugateImperative(verb, pronounKey);

  return {
    form,
    pronoun: PRONOUNS[pronounKey].arabic,
    pronounKey,
    tense,
    mood,
  };
}

export function buildConjugationTable(verb: ArabicVerb) {
  return {
    past: PRONOUN_ORDER.map(k => getConjugation(verb, k, "past")),
    present: {
      indicative: PRONOUN_ORDER.map(k => getConjugation(verb, k, "present", "indicative")),
      subjunctive: PRONOUN_ORDER.map(k => getConjugation(verb, k, "present", "subjunctive")),
      jussive: PRONOUN_ORDER.map(k => getConjugation(verb, k, "present", "jussive")),
    },
    future: PRONOUN_ORDER.map(k => getConjugation(verb, k, "future")),
    imperative: PRONOUN_ORDER.map(k => getConjugation(verb, k, "imperative")),
  };
}
