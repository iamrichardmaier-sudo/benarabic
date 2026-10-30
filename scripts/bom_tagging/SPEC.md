# Tagging untagged corpus words

`public.bible_word_tags` holds every distinct spelling (`surface`) of the Arabic Bible and Book of Mormon.
Rows with `tagged_at IS NULL` have no root, lemma, part of speech or gloss yet. Your job is to tag a slice
of them the way the app's tagger does (`supabase/functions/tag-bible-word/index.ts`; read its prompt).

## Your slice

Query the database READ-ONLY (a single `SELECT`; never INSERT/UPDATE/DELETE, never DDL) with the Supabase
`execute_sql` tool, project `fphpcfecgnfoogfaeihu`:

```sql
select surface, bible_count, bom_count from public.bible_word_tags
where tagged_at is null and bible_count + bom_count >= 2
order by bible_count + bom_count desc, surface collate "C"
limit 200 offset <K*200>;
```

K is your batch number minus one (batch t01 is K=0). Most spellings come from the Book of Mormon. A
spelling's verse is findable with `grep -rl` in `/home/user/benarabic/public/bom/*/*.json` (fields
`v` verse number, `a` Arabic, `e` English) and in `/home/user/benarabic/public/bible/` for the Bible;
read the English next to it when the sense is not clear.

## Output

Write `$WORK/out/tNN.jsonl`, one JSON object per slice row, in the order you got them:

```
{"surface": "وَيَلْتَصِقُ", "root": "ل-ص-ق", "lemma": "الْتَصَقَ", "pos": "verb", "verb_form": "VIII", "gloss": "and he cleaves"}
```

* `surface` echoes the input exactly (copy it; do not retype Arabic by hand).
* `root`: letters joined by `-`, hamza written أ, or `null` for particles, names, loanwords.
* `lemma`: the content word under the clitics (و ف ب ل ك, the article, pronoun suffixes, plural and dual
  endings), **fully voweled**: a verb in the 3rd masculine singular past, a noun or adjective singular
  indefinite and bare (no article, no tanwin). For a name, the name; for a particle, the particle.
* `pos`: `verb`, `noun`, `adjective`, `participle`, `proper_noun`, `particle` or `other`.
* `verb_form`: `I`..`X` for verbs and participles, else `null`. Quadriliteral verbs: `I`.
* `gloss`: 2 to 6 English words saying what this spelling means in the text ("and he cleaves", "for his servant").
* Nothing you are unsure of: omit the row (leave it untagged) rather than guess. Say how many you omitted.
* A spelling that is two readings: choose the one the English of the verse shows.

Check: `python3 /home/user/benarabic/scripts/bom_tagging/check_tags.py $WORK tNN` until exit 0. Touch no other
file, never run git, and never write to the database.
