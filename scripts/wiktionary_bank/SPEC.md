# Annotating Wiktionary batches

Same contract as `scripts/quran/ANNOTATION_SPEC.md` (read it first: entry format, fields, quality bar),
with these differences. The roots in these batches have **no Qur'anic word**, so:

* every entry is `"src": "msa"` with **no `q`, no `qen`** (the validator rejects them);
* there is no Qur'an coverage, but every Wiktionary word in your dossiers that has any subtitle
  frequency (`freq > 0`) must be an entry **or** a skip line `{"skip": "<word>", "why": "..."}`
  (a spelling variant, an inflected form of a word you list, a word you are not sure of, a name,
  a loanword that does not belong to the root, a proper noun).
* A dossier is only Wiktionary's list for the root. Verify each word: the root may be wrong
  (Wiktionary sometimes files a word under the wrong root), the vowels may be wrong, the gloss is a hint.
  A word that does not contain the root's radicals is an error unless you add `"override": "<why>"`.
* Add the other real, common words of the root that Wiktionary lacks (other verb forms, masdars,
  participles, adjectives), exactly as the Qur'an spec asks. Typical root: 3 to 12 entries.
* Modern vocabulary is welcome (هاتِف، قانون، نِظام). Colloquial-only words are not.
* Check with `python3 /home/user/benarabic/scripts/wiktionary_bank/check_batch.py $WORK wNN` until exit 0.
* Never write outside `$WORK/out/wNN.jsonl`; never run git; never touch a database.

## Unrooted batches (`uNN`)

A `uNN` batch lists Wiktionary words whose page names no root (`$WORK/dossiers/uNN.txt`). For each word:

* work out its root and verify the radicals appear in the word; write the entry with that root;
* a name, loanword (دُولار), number or particle with no root: `"root": null, "rootless": true`, type `other` or `noun`;
* a word whose root is a Qur'an root is covered by another annotator; the checker rejects it. Write a skip
  `{"skip": "<word>", "why": "Qur'an root"}` instead. If unsure whether the root occurs in the Qur'an, write
  the entry anyway and let the checker say;
* many listed words are inflected forms of a word already in the list (a plural, a pronoun suffix, a form
  with the article): skip them with the lemma named in `why`; two pages for one word: one entry;
* the same quality rule: a word you are not sure of is a skip.
* Check with `python3 /home/user/benarabic/scripts/wiktionary_bank/check_batch.py $WORK uNN`.
