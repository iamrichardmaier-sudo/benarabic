-- Give lemmas to corpus spellings that were tagged with a root only (by affix-stripping).
--
-- apply_corpus_lemmas(tags): for spellings in public.bible_word_tags that have tagged_at set but no
-- lemma, sets root (the caller has verified or corrected it), lemma, part of speech, verb form and gloss,
-- and stamps tagged_at again so sync_dictionary_from_tags(since) picks them up. Rows that already have a
-- lemma are never touched. `tags` is a JSON array of {surface, root, lemma, pos, verb_form, gloss}.
-- For the service role only.

create or replace function public.apply_corpus_lemmas(tags jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  n integer;
begin
  with t as (
    select * from jsonb_to_recordset(tags)
      as r(surface text, root text, lemma text, pos text, verb_form text, gloss text)
  ), upd as (
    update public.bible_word_tags b
       set root = nullif(t.root, ''),
           lemma = t.lemma,
           pos = t.pos,
           verb_form = nullif(t.verb_form, ''),
           gloss = t.gloss,
           tagged_at = now()
      from t
     where b.surface = t.surface
       and b.tagged_at is not null
       and b.lemma is null
       and t.lemma is not null and t.pos is not null
    returning 1
  )
  select count(*) into n from upd;
  return n;
end;
$$;

revoke all on function public.apply_corpus_lemmas(jsonb) from public, anon, authenticated;
