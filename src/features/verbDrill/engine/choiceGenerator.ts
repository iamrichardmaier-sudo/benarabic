import { ArabicVerb, PronounKey } from "./types";
import { PRONOUNS } from "./pronouns";
import { conjugatePresent, conjugatePast } from "./conjugate";

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function generateChoices(
  correct: string,
  verb: ArabicVerb,
  tense: "past" | "present"
): string[] {
  const allKeys = Object.keys(PRONOUNS) as PronounKey[];
  const choices = new Set<string>([correct]);
  const shuffled = shuffle(allKeys);

  for (const key of shuffled) {
    if (choices.size >= 4) break;
    const wrong =
      tense === "past"
        ? conjugatePast(verb, key)
        : conjugatePresent(verb, key, "indicative");
    if (wrong !== correct) choices.add(wrong);
  }

  return shuffle(Array.from(choices));
}
