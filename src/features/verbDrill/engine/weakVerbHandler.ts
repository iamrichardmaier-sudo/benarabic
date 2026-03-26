import { ArabicVerb } from "./types";

export function adjustWeakPresentStem(stem: string, verb: ArabicVerb): string {
  if (!verb.weakType) return stem;
  const [fa, ain, lam] = verb.root;

  if (verb.weakType === "hollow") {
    const longVowel = verb.presentVowel === "u" ? "ُو" : "ِي";
    return `${fa}${longVowel}${lam}`;
  }

  if (verb.weakType === "defective") {
    return `${fa}ْ${ain}${verb.presentVowel === "i" ? "ِي" : "ُو"}`;
  }

  if (verb.weakType === "assimilated") {
    return `${ain}${verb.presentVowel === "i" ? "ِ" : "ُ"}${lam}`;
  }

  return stem;
}
