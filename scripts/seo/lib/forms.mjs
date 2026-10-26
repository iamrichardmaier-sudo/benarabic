/** The ten verb forms: pattern and what each does to a root. */
// Mirrors src/lib/morphology.ts VERB_FORM_GLOSSES so the generator stays
// dependency-free (no TS import at build time).
export const FORMS = {
  I:    { pattern: 'فَعَلَ',    summary: 'The plain action',
          detail: 'The base form. It carries the root idea with nothing added — whatever the root means at its simplest.' },
  II:   { pattern: 'فَعَّلَ',   summary: 'Causative or intensive',
          detail: 'Doubling the middle letter either makes someone else do the action, or makes it thorough and repeated.' },
  III:  { pattern: 'فاعَلَ',   summary: 'Done to or with someone',
          detail: 'Stretching the first vowel points the action at another party — you do it to them, or alongside them.' },
  IV:   { pattern: 'أَفعَلَ',   summary: 'Causative',
          detail: 'A prefixed hamza makes something or someone undergo the root action. Often blunter and more transitive than Form II.' },
  V:    { pattern: 'تَفَعَّلَ',  summary: 'Reflexive of Form II',
          detail: 'Form II with a تَ in front: the action turns back on the doer, or is undergone gradually.' },
  VI:   { pattern: 'تَفاعَلَ',  summary: 'Mutual action',
          detail: 'Form III with a تَ in front: two or more parties doing it to each other.' },
  VII:  { pattern: 'اِنفَعَلَ',  summary: 'Passive or resultative',
          detail: 'The subject undergoes the action, often with no agent named — it simply happens to them.' },
  VIII: { pattern: 'اِفتَعَلَ',  summary: 'Reflexive, often idiomatic',
          detail: 'An infixed ت. Frequently the action done for oneself or to oneself, though many Form VIII verbs drift into their own meanings.' },
  IX:   { pattern: 'اِفعَلَّ',   summary: 'Colours and defects',
          detail: 'A narrow form, almost entirely used for becoming a colour or acquiring a bodily defect.' },
  X:    { pattern: 'اِستَفعَلَ', summary: 'Seeking or considering',
          detail: 'The اِست prefix means asking for the root action, or regarding something as having that quality.' },
};

export const FORM_LIST = Object.keys(FORMS);
