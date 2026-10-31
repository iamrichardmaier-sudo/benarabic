# Daily translation answer keys

Each day the learner gets three hard English sentences to translate into
Arabic (Learn → Daily translation). There is no AI at grading time: the app
checks the attempt against an answer key written the evening before
(`src/lib/answer-key.ts`). A key that predicts the learner's mistakes well is
the whole feature, so write it with care.

One file per day: `supabase/answer-keys/<yyyy-mm-dd>.json`. Copy the shape of
the newest existing file.

## Writing the sentences

- Read the learner's newest flashcards first (`flashcards`, newest
  `created_at`). Each sentence uses 2–4 of them, preferring words not used in
  the last few days' keys (see the previous files). List them in
  `target_words` as written on the cards.
- Modern Standard Arabic only, never dialect, even though some cards are
  Shaami.
- 18–30 English words, natural modern English, each sentence testing a
  different hard structure, named in `grammar_focus`. Rotate through: لو /
  لولا, إذا / إن, كان + present (past habit), كان قد (pluperfect), the
  passive, relative clauses (with a resumptive pronoun), حال clauses, إنّ / أنّ
  / لكنّ, كاد / ما زال / لم يعد, the absolute object, exception (إلا / غير /
  سوى), comparatives and colour adjectives, numbers with counted nouns, idafa
  chains, verbal nouns for أن + verb, لم / لن / لا negation, dual agreement.
- Look at recent attempts (`translation_attempts`, joined to
  `translation_challenges`): the rules behind `fix` entries in their
  `feedback.words` are the learner's weak spots. At least one sentence
  should test one of them.
- Flagged attempts (`flagged = true`, with `flag_note`) mean the learner
  thinks the feedback was wrong. Check each one. If the key was wrong, fix
  that day's file and reload it, and don't repeat the error.

## The key

- `model_answer`: one correct translation with full vowels.
- `reference_translations`: 6–8 genuinely different correct translations
  without vowels (verbal and nominal word order, synonyms, constructions).
- `chunks`: the sentence split into 4–6 clauses, in order, each with:
  - `en`: the English it covers.
  - `accept`: every correct wording you can think of for that clause, as
    the learner would write it (no vowels needed). Be generous: a correct
    wording missing from `accept` comes back "unchecked".
  - `mistakes`: the errors a learner is most likely to make there. Each
    has the wrong `text` as it would be written, the `rule` it breaks (one
    line), and a `note` explaining the fix to the learner in one or two
    sentences. Aim for 3–6 per clause. Think about: gender agreement of
    verbs, adjectives and pronouns; non-human plurals taking feminine
    singular; case and definiteness in idafa; number–noun agreement; wrong
    verb form (II for V and so on); wrong preposition; إذا for هل or لو;
    أنّ after قال; كان + past for a habit; wrong broken plural; English word
    order.
  - A mistake that is in fact valid Arabic gets `"status": "alternative"`
    and is shown as "also correct".
  - A mistake that differs from a correct form only in the hamza seat
    (تقول أنّ for تقول إنّ) gets `"strict": true`.
- `pitfalls`: 3–5 one-line reminders shown with the sentence.

Matching is on whole words, ignoring vowels, alef/hamza seats, ة/ه and ى/ي.
The first word of a form may carry a joined و or ف. Keep each form short
(2–5 words): long forms only match if the learner wrote exactly those words.

## Check and load

```bash
node --experimental-strip-types scripts/check-answer-key.ts supabase/answer-keys/<day>.json
```

The key passes when every correct translation comes back correct on every
clause and every predicted mistake is caught as written. Fix whatever it
reports and run it again. Try likely wrong attempts with
`--try '{"1": ["..."], "2": ["..."], "3": ["..."]}'`.

Then load it (an upsert, so reloading a fixed key is safe):

```bash
node --experimental-strip-types scripts/check-answer-key.ts supabase/answer-keys/<day>.json --sql <learner-user-id>
```

and run the printed SQL against the project.
