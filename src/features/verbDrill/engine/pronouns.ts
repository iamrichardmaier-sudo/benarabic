import { PronounKey } from "./types";

export const PRONOUNS: Record<PronounKey, {
  arabic: string;
  prefixPresent: string;
  suffixPast: string;
  suffixPresent: {
    indicative: string;
    subjunctive: string;
    jussive: string;
  };
  suffixImperative: string;
  gender: "m" | "f" | "mf";
  number: "singular" | "dual" | "plural";
}> = {
  ana:      { arabic: "أنا",   prefixPresent: "أَ", suffixPast: "تُ",    suffixPresent: { indicative: "ُ",   subjunctive: "َ",   jussive: ""    }, suffixImperative: "",    gender: "mf", number: "singular" },
  anta:     { arabic: "أنتَ",  prefixPresent: "تَ", suffixPast: "تَ",    suffixPresent: { indicative: "ُ",   subjunctive: "َ",   jussive: ""    }, suffixImperative: "",    gender: "m",  number: "singular" },
  anti:     { arabic: "أنتِ",  prefixPresent: "تَ", suffixPast: "تِ",    suffixPresent: { indicative: "ينَ", subjunctive: "ي",   jussive: "ي"   }, suffixImperative: "ي",  gender: "f",  number: "singular" },
  huwa:     { arabic: "هو",    prefixPresent: "يَ", suffixPast: "",      suffixPresent: { indicative: "ُ",   subjunctive: "َ",   jussive: ""    }, suffixImperative: "",    gender: "m",  number: "singular" },
  hiya:     { arabic: "هي",    prefixPresent: "تَ", suffixPast: "تْ",    suffixPresent: { indicative: "ُ",   subjunctive: "َ",   jussive: ""    }, suffixImperative: "",    gender: "f",  number: "singular" },
  antuma:   { arabic: "أنتما", prefixPresent: "تَ", suffixPast: "تُمَا", suffixPresent: { indicative: "انِ", subjunctive: "ا",   jussive: "ا"   }, suffixImperative: "ا",  gender: "mf", number: "dual"     },
  huma_m:   { arabic: "هما",   prefixPresent: "يَ", suffixPast: "ا",     suffixPresent: { indicative: "انِ", subjunctive: "ا",   jussive: "ا"   }, suffixImperative: "",    gender: "m",  number: "dual"     },
  huma_f:   { arabic: "هما",   prefixPresent: "تَ", suffixPast: "تَا",   suffixPresent: { indicative: "انِ", subjunctive: "ا",   jussive: "ا"   }, suffixImperative: "",    gender: "f",  number: "dual"     },
  nahnu:    { arabic: "نحن",   prefixPresent: "نَ", suffixPast: "نَا",   suffixPresent: { indicative: "ُ",   subjunctive: "َ",   jussive: ""    }, suffixImperative: "",    gender: "mf", number: "plural"   },
  antum:    { arabic: "أنتم",  prefixPresent: "تَ", suffixPast: "تُم",   suffixPresent: { indicative: "ونَ", subjunctive: "وا",  jussive: "وا"  }, suffixImperative: "وا", gender: "m",  number: "plural"   },
  antunna:  { arabic: "أنتن",  prefixPresent: "تَ", suffixPast: "تُنَّ", suffixPresent: { indicative: "نَ",  subjunctive: "نَ",  jussive: "نَ"  }, suffixImperative: "نَ", gender: "f",  number: "plural"   },
  hum:      { arabic: "هم",    prefixPresent: "يَ", suffixPast: "وا",    suffixPresent: { indicative: "ونَ", subjunctive: "وا",  jussive: "وا"  }, suffixImperative: "",    gender: "m",  number: "plural"   },
  hunna:    { arabic: "هن",    prefixPresent: "يَ", suffixPast: "نَ",    suffixPresent: { indicative: "نَ",  subjunctive: "نَ",  jussive: "نَ"  }, suffixImperative: "",    gender: "f",  number: "plural"   },
};

export const PRONOUN_ORDER: PronounKey[] = [
  "ana", "anta", "anti", "huwa", "hiya",
  "antuma", "huma_m", "huma_f",
  "nahnu", "antum", "antunna", "hum", "hunna",
];

export const PRONOUN_GROUPS = [
  { label: "Singular", keys: ["ana", "anta", "anti", "huwa", "hiya"] as PronounKey[] },
  { label: "Dual", keys: ["antuma", "huma_m", "huma_f"] as PronounKey[] },
  { label: "Plural", keys: ["nahnu", "antum", "antunna", "hum", "hunna"] as PronounKey[] },
];
