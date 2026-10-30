# Qur'an word bank

Builds rows for the shared word bank (`public.words`): every Qur'anic content word, plus the other
words of the same roots, each tagged with its root, verb form, plural, gender, a short Qur'an excerpt
and ranked connections to its relatives. Loaded words sit in the bank and in **no deck**.

## Pipeline

| step | script | output |
|---|---|---|
| 1. corpus | `build_corpus.py WORK` | all 6,236 verses, 77k words with root, lemma, part of speech |
| 2. evidence | `build_dossiers.py WORK bank-snapshot.json` | one dossier per root (1,816) + the rootless names |
| 3. shards | `make_shards.py WORK` | 63 root shards + `rootless`, checked against `shards.json` |
| 4. annotate | people or models, following `ANNOTATION_SPEC.md` | `WORK/out/sNN.jsonl` |
| 5. validate | `quran_words.py check sNN --work WORK` | exit 0 or a list of errors |
| 6. merge | `merge_words.py WORK OUTDIR` | `seed/words-NNN.json`, `dataset.jsonl`, `report.md` |
| 7. load | `load_words.py SHA N` prints SQL | rows in `public.words` |

`HANDOFF.md` is the prompt for a second annotator working a disjoint set of shards.

### What the validator guarantees

* the root's radicals appear, in order, in the word (weak letters interchangeable);
* the Qur'an excerpt is **copied by the pipeline** from the verse text, never typed by an annotator,
  and contains a word of the entry's root;
* every Qur'anic verb form and lemma of a shard's roots is an entry or a stated skip.

### What the merge does

* drops a word the bank already holds (the same verb form of the same root, or the same bare
  spelling under the same root and part of speech family);
* because `words.key` is unique, gives the rarer of two words that share a bare spelling the bank's
  existing bracketed disambiguator, e.g. `كاتَبَ (فعل)`;
* ranks each word's connections: a verb's masdar and participles first, a noun's base verb first,
  then by Qur'anic frequency, and includes the bank's own words of the root.

## Loading, and undoing it

`load_words.py` has Postgres fetch each chunk from the public repo at an immutable commit (the way
`seed_bible_word_queue` fetched the Gospel word list), and inserts only keys that do not exist. It
never updates or deletes a row and never writes `deck_words` or `flashcards`.

Loaded rows have `created_by IS NULL`, but so can rows another process loads, so **do not roll back by
that column alone**. `load_words.py SHA BATCH N --rollback` prints SQL that deletes exactly the rows of
those chunks (matched on key and word) and only if no deck or flashcard refers to them.

Merge against a fresh export of the live bank each time (`import_bank_export.py`), never an old
snapshot: other loads may have landed in between, and the merge drops or brackets against whatever is there.

## Sources, and what they require

Rebuilt locally from public registries; none of the source data is committed except the rows.

| source | used for | terms |
|---|---|---|
| Quranic Arabic Corpus morphology 0.1 (Kais Dukes), via the `qurancorpus` package | root, lemma, part of speech, verb form | GPL; may be used in any website or application **provided the Quranic Arabic Corpus is clearly credited with a link to http://quran.uk.net** |
| Tanzil Qur'an text | the Arabic of every `quran_example` | CC BY-ND 3.0: copied verbatim, credit and link to http://tanzil.info required |
| `quran-search-engine` (MIT) | complete text, the QAC 4.0 form-to-root lexicon (fills the 114 verses QAC 0.1 lacks) | MIT |
| quran.com word-by-word English, via `@kmaslesa/holy-quran-word-by-word-full-data` (ISC) | a hint shown to annotators; not stored in the database | not redistributed |
| English Wiktionary (CC BY-SA 4.0), via `scripts/seo/data/dictionary.json.gz` | candidate words beyond scripture, shown to annotators and verified by them | not stored verbatim |

The English of each excerpt (`quran_example_en`) and every gloss is original wording written for
this project, not taken from a published translation.

**The app must show the Quranic Arabic Corpus and Tanzil credits somewhere users can see them
before these excerpts are shown.**
