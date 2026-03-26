import { ArabicVerb, VerbForm } from "./types";

export const FORM_PATTERNS: Partial<Record<VerbForm, { past: string; present: string }>> = {
  1: { past: "فَعَلَ", present: "يَفْعَلُ" },
  2: { past: "فَعَّلَ", present: "يُفَعِّلُ" },
  3: { past: "فَاعَلَ", present: "يُفَاعِلُ" },
  4: { past: "أَفْعَلَ", present: "يُفْعِلُ" },
  5: { past: "تَفَعَّلَ", present: "يَتَفَعَّلُ" },
  6: { past: "تَفَاعَلَ", present: "يَتَفَاعَلُ" },
  7: { past: "اِنْفَعَلَ", present: "يَنْفَعِلُ" },
  8: { past: "اِفْتَعَلَ", present: "يَفْتَعِلُ" },
  10: { past: "اِسْتَفْعَلَ", present: "يَسْتَفْعِلُ" },
};

export function getPresentStem(verb: ArabicVerb): string {
  const [fa, ain, lam] = verb.root;
  const v = verb.presentVowel;
  const vowelMap = { a: "َ", i: "ِ", u: "ُ" };
  const middleVowel = vowelMap[v];
  return `${fa}ْ${ain}${middleVowel}${lam}`;
}

export function getFormStem(verb: ArabicVerb): string {
  if (verb.form === 1) return getPresentStem(verb);
  throw new Error(`Form ${verb.form} stems not yet implemented`);
}
