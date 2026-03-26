export type WeakType = "hollow" | "defective" | "assimilated" | null;
export type VerbForm = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type Tense = "past" | "present" | "future" | "imperative";
export type Mood = "indicative" | "subjunctive" | "jussive";
export type PronounKey =
  | "ana" | "anta" | "anti"
  | "huwa" | "hiya"
  | "nahnu"
  | "antuma" | "huma_m" | "huma_f"
  | "antum" | "antunna"
  | "hum" | "hunna";

export type DrillMode = "study" | "flashcard" | "multipleChoice" | "typeIn";

export interface ArabicVerb {
  root: [string, string, string];
  base: string;
  presentVowel: "a" | "i" | "u";
  form: VerbForm;
  irregular: boolean;
  weakType: WeakType;
  meaning: string;
  example?: string;
}

export interface ConjugationResult {
  form: string;
  pronoun: string;
  pronounKey: PronounKey;
  tense: Tense;
  mood?: Mood;
}
