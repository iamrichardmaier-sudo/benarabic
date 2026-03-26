import { ArabicVerb, PronounKey, Tense, Mood } from "./types";
import { PRONOUNS } from "./pronouns";
import { getConjugation } from "./conjugate";

const TIME_WORDS: Record<Tense, string> = {
  past: "أَمْسِ",
  present: "الآنَ",
  future: "غَدًا",
  imperative: "",
};

const VERB_SENTENCES: Record<string, { template: string }> = {
  "to write": { template: "____ رِسَالَةً" },
  "to go":    { template: "____ إِلَى المَدْرَسَةِ" },
  "to eat":   { template: "____ الطَّعَامَ" },
  "to drink": { template: "____ المَاءَ" },
  "to sit":   { template: "____ عَلَى الكُرْسِيِّ" },
  "to say":   { template: "____ الحَقِيقَةَ" },
  "to promise": { template: "____ بِذَلِكَ" },
  "to throw": { template: "____ الكُرَةَ" },
};

export function generateSentence(
  verb: ArabicVerb,
  pronounKey: PronounKey,
  tense: Tense,
  mood: Mood = "indicative"
): { sentence: string; answer: string; translation: string } {
  const pronoun = PRONOUNS[pronounKey].arabic;
  const result = getConjugation(verb, pronounKey, tense, mood);
  const timeWord = TIME_WORDS[tense];

  const template = VERB_SENTENCES[verb.meaning]?.template ?? "____ شَيْئًا";
  const sentence = `${pronoun} ${template}${timeWord ? " " + timeWord : ""}`;
  const answer = result.form;
  const translation = `${pronoun} [${verb.meaning}]${timeWord ? " " + timeWord : ""}`;

  return { sentence, answer, translation };
}
