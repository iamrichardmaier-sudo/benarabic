# Forms data

`verb_conjugations` is generated offline and stored; the app never conjugates.

1. `src/lib/verb-forms/generate.ts` writes the paradigm of Forms II–X for a triliteral root
   (sound, hollow, defective, assimilated, doubled, hamzated). Roots with two weak letters, or a
   hamza plus a weak letter, are returned as `null` and left for a person.
2. `pairs.txt` lists the (root, form) pairs that have evidence: a form in the deck or one the
   scripture dictionary attests. Everything else is simply absent, which the app draws as "not used".
3. `npx vite-node scripts/forms/seed.ts > scripts/forms/seed.sql` builds the SQL. It compares each
   generated paradigm with the deck's and the dictionary's voweled forms:
   - exact voweled match → `high` (usable in quizzes)
   - deck present but different → the deck's spelling is stored as `medium` (admin review)
   - dictionary-attested only → generated, `medium`
4. Weak verbs are never trusted on rules alone: they reach `high` only through an exact match with
   an independent source, or when an admin approves them in Forms → Review.

Hand-written rows (source `spec fixture` / `curated (colour verb)`): the Form IX colour verbs and the
verbs named in the spec (استفاد، أفاد، وصل).

Licence note: the generator is original code; no code or data was taken from Qutrub or any other
conjugation library.
