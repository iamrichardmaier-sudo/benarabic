# Tagging untagged spellings that occur once

Read `SPEC.md` first (output format, quality rules, checker). Differences:

* Your slice (READ-ONLY single `SELECT`, project `fphpcfecgnfoogfaeihu`):

```sql
select surface, bible_count, bom_count from public.bible_word_tags
where tagged_at is null and bible_count + bom_count = 1
order by surface collate "C"
limit 250 offset <K*250>;
```

* Each spelling occurs exactly once in the corpus, so its verse is unique. Most are Book of Mormon.
  When a spelling is ambiguous (a name, a missing shadda, two possible lemmas), find the verse with
  `grep -rl` in `/home/user/benarabic/public/bom/*/*.json` (and `public/bible/`), read the English beside it,
  and decide. A name is `proper_noun` with `root: null` and the name in English as the gloss.
* Output file `$WORK/out/<batch>.jsonl`; run `check_tags.py $WORK <batch>; echo rc=$?` until rc=0.
* Omit anything you cannot resolve with confidence; do not guess.
