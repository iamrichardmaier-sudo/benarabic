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
