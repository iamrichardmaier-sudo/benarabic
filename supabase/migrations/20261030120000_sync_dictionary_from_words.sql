-- Every word in the shared word bank (public.words) should have a matching
-- entry in the dictionary (public.dictionary), which the search screens read.
--
-- The dictionary was built from the tagged Bible and Book of Mormon corpus, so
-- words that arrived through the word bank (the Qur'an word bank, and cards
-- learners added) had no entry. This function adds the missing ones. It only
-- inserts: an entry that already exists is never touched, so it is safe to run
-- again whenever the word bank grows.
--
-- Frequency columns stay 0 for these entries: they are counts in the Bible and
-- Book of Mormon, and a word that arrived through the bank has no such count.
-- The entry's tags (gender, plural, principal parts, Qur'an excerpt) go in
-- `details`, so nothing the bank knows about the word is lost.

create or replace function public.sync_dictionary_from_words()
returns integer
language plpgsql
set search_path = public
as $$
declare
  added integer;
begin
  with src as (
    select distinct on (lemma, root, pos)
           lemma, root, pos, verb_form, english, source, details
    from (
      select w.word_voweled as lemma,
             w.root,
             case w.word_type
               when 'noun' then 'noun'
               when 'verb' then 'verb'
               when 'masdar' then 'masdar'
               when 'participle' then 'participle'
               when 'adjective' then 'adjective'
               else 'other'
             end as pos,
             w.verb_form,
             w.english,
             case when w.quran_reference is not null then 'quran' else 'bank' end as source,
             jsonb_strip_nulls(jsonb_build_object(
               'gender', w.gender,
               'plural', w.fusha_plural,
               'past', w.past_tense,
               'present', w.present_tense,
               'masdar', w.masdar_form,
               'quran_example', w.quran_example,
               'quran_example_en', w.quran_example_en,
               'quran_reference', w.quran_reference
             )) as details,
             w.created_at
      from public.words w
      where w.word_type is distinct from 'sentence'
        and coalesce(w.word_voweled, '') <> ''
        and coalesce(w.english, '') <> ''
    ) t
    order by lemma, root, pos, created_at
  ),
  fresh as (
    select s.*, public.normalize_arabic(s.lemma) as lemma_key
    from src s
    where not exists (
      select 1 from public.dictionary d
      where d.lemma_key = public.normalize_arabic(s.lemma)
        and d.root is not distinct from s.root
        and (d.pos = s.pos or d.lemma = s.lemma)
    )
  ),
  ins as (
    insert into public.dictionary
      (lemma, lemma_key, root, root_key, pos, verb_form, glosses, gloss_text, source, details)
    select f.lemma, f.lemma_key, f.root,
           case when f.root is null then null
                else replace(public.normalize_arabic(f.root), '-', '') end,
           f.pos, f.verb_form,
           array[f.english], f.english,
           f.source, f.details
    from fresh f
    on conflict (lemma, root, pos) do nothing
    returning 1
  )
  select count(*) into added from ins;
  return added;
end;
$$;

revoke all on function public.sync_dictionary_from_words() from public, anon, authenticated;
