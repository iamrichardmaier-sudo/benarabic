# Giving lemmas to rows that have only a root

Some rows of `public.bible_word_tags` were tagged with a root by affix-stripping (`propagate-roots`) but
have no lemma, part of speech, verb form or gloss. Read `SPEC.md` first: output format, quality rules and
the checker are the same. Differences:

* Your slice (READ-ONLY single `SELECT`, project `fphpcfecgnfoogfaeihu`):

```sql
select surface, root, bible_count, bom_count from public.bible_word_tags
where tagged_at is not null and lemma is null and bible_count + bom_count >= 2
order by bible_count + bom_count desc, surface collate "C"
limit 200 offset <K*200>;
```

* The `root` shown is a **hint and is often wrong** (the stripper cannot tell a radical from an affix:
  وَصَلَ comes filed under ص-ل-و, يُريدونَ under ر-و-د when you should check it). Decide the correct root
  yourself, from the content word under the clitics. Write your root in the output; it replaces the hint.
  A particle, name or loanword has `"root": null`.
* The checker still requires the root's radicals in the lemma (weak letters interchangeable).
* Omit any row you are not sure of; do not guess.

## Second pass on the skipped rows

Rows the first pass left out are the ambiguous ones (a missing shadda, a person-ambiguous verb, a word that
could be two lemmas). For these, **look the spelling up in its verse** before deciding: Book of Mormon
verses are in `/home/user/benarabic/public/bom/*/*.json` (fields `v`, `a` Arabic, `e` English), the Bible in
`/home/user/benarabic/public/bible/`. Use `grep -l` on the spelling, read the English beside it, and choose
the reading the verse shows. Only omit a row if the verse still leaves it genuinely unresolved. Offsets for
this pass use the same query, which now returns only these rows.
