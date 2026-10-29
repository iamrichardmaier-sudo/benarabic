# Handoff: a second annotator for the Qur'an word bank

Paste everything between the two rules into the other AI. It is written to be self-contained and to
keep the two of you out of each other's way.

---

You are joining a project already in progress on the GitHub repo `iamrichardmaier-sudo/benarabic`
(an Arabic-learning app: React + Supabase). Another Claude Code session, the **owner**, is building
out the shared word bank (`public.words`) with every Qur'anic content word plus the other words of
their roots, each tagged with its root, verb form, plural, gender, a short Qur'an excerpt, and
ranked connections to its relatives. The owner has split the annotation into 63 root shards
(`s01`..`s63`) plus a `rootless` shard, and is running most of them in parallel.

## Your territory (and only this)

* You annotate **shards `s49` through `s63`**. Nothing else.
* You write **only** `scripts/quran/annotations/s49.jsonl` ... `s63.jsonl`, on **your own branch**
  `claude/quran-annotations-b`, created from the owner's branch `claude/modest-curie-e20slw`.
* You push **only** your branch. You never push to `claude/modest-curie-e20slw` or `main`, never
  open a pull request unless the user asks, and never rebase or force-push.

## Things you must never do

* Do not connect to, query or write to the Supabase database or any Supabase tool. The owner is the
  only writer; a second writer would duplicate or collide on unique keys.
* Do not edit anything under `scripts/quran/` other than your annotation files (the tooling and
  `shards.json` are the owner's; if you think they are wrong, say so in your final report).
* Do not annotate shards outside `s49`..`s63`, even if you finish early or another shard looks easy.
  The owner decides who does what; report and wait.
* Do not commit the corpus, dossiers or `WORK` directory: they derive from GPL and CC BY-ND data and
  are rebuilt locally. Commit only your `.jsonl` files.

## Setup (about five minutes; needs network access to PyPI and npm)

```sh
git clone https://github.com/iamrichardmaier-sudo/benarabic.git && cd benarabic
git checkout claude/modest-curie-e20slw && git checkout -b claude/quran-annotations-b
WORK="$HOME/quran-work"; mkdir -p "$WORK"
python3 -I scripts/quran/build_corpus.py "$WORK"
cp scripts/quran/bank-snapshot.json "$WORK/existing_words.json"
python3 -I scripts/quran/build_dossiers.py "$WORK" scripts/quran/bank-snapshot.json
python3 -I scripts/quran/make_shards.py "$WORK" --verify     # must print: OK: 63 shards match shards.json
python3 -I scripts/quran/make_shards.py "$WORK"              # writes $WORK/shards/*.json (does not touch the repo)
mkdir -p "$WORK/out" scripts/quran/annotations
```

If `--verify` does not print OK, stop and tell the user: your scope differs from the owner's and your
shard numbers would not mean the same roots.

## The job

Read `scripts/quran/ANNOTATION_SPEC.md` in full; it is the contract (entry format, what to include,
quality bar, validator). For each shard `sNN` in `s49`..`s63`:

1. Read `$WORK/shards/sNN.json` (dossier numbers) and each `$WORK/dossiers/NNNN.txt`.
2. Append your entries to `$WORK/out/sNN.jsonl` in groups of roots.
3. Run `python3 scripts/quran/quran_words.py check sNN --work "$WORK"` until it exits 0.
4. Copy the file to `scripts/quran/annotations/sNN.jsonl`.

If your environment can run sub-agents, run **one per shard**, in parallel, each with this prompt
(substitute NN and the WORK path):

> You are an Arabic lexicographer annotating word-bank rows for a learner's app. Read
> `scripts/quran/ANNOTATION_SPEC.md` completely, then do it for shard `sNN`, with WORK=`<WORK path>`.
> Read the dossiers listed in `$WORK/shards/sNN.json`, append entries to `$WORK/out/sNN.jsonl` in
> groups, and run `python3 scripts/quran/quran_words.py check sNN --work $WORK` until it exits 0.
> Quality over quantity: if you are not certain a word exists with the vowels you give, leave it out.
> Touch no other file, never run git, never touch a database. Reply in three lines: shard id, entry
> count, anything you were unsure about.

When all 15 shards pass `check`:

```sh
git add scripts/quran/annotations
git commit -m "Quran word bank: annotations for shards s49-s63"
git push -u origin claude/quran-annotations-b
```

## Final report to the user

One short message: for each shard its entry count and `check` result, the branch name, and any root
where you deliberately left words out and why. Do not describe the pipeline back to them.

---

## Notes for the owner (not part of the prompt)

* The owner merges the other AI's work with
  `git checkout claude/modest-curie-e20slw && git checkout claude/quran-annotations-b -- scripts/quran/annotations`
  then copies those files into `WORK/out/`, runs `check` on each, and runs `merge_words.py` once for
  everything. Nothing the other AI produces reaches the database except through that step.
* Until the user confirms the other AI is running, shards `s49`..`s63` are unclaimed: if the owner
  needs them done, the owner can run them itself.
