-- Tag the corpus spellings that have no tag yet, and give their lemmas dictionary entries.
--
-- apply_corpus_tags(tags): fills root, lemma, part of speech, verb form and gloss on spellings in
-- public.bible_word_tags that are still untagged (tagged_at IS NULL), and stamps tagged_at. It never
-- overwrites a row that is already tagged. `tags` is a JSON array of
-- {surface, root, lemma, pos, verb_form, gloss}.
--
-- sync_dictionary_from_tags(since): for every lemma that has a spelling tagged at or after `since`,
-- adds the lemma to public.dictionary or, when the dictionary already holds that word (same consonant
-- skeleton and root, and the same part of speech or the same voweling), raises its counts. It builds on
-- the same grouping as the original dictionary build but only inserts and raises: it never truncates
-- and never lowers a count, so entries added from the word bank are kept.
--
-- Both are for the service role only.

create or replace function public.apply_corpus_tags(tags jsonb)
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
       and b.tagged_at is null
       and t.lemma is not null and t.pos is not null
    returning 1
  )
  select count(*) into n from upd;
  return n;
end;
$$;

create or replace function public.sync_dictionary_from_tags(since timestamptz)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  inserted integer;
  raised integer;
begin
  create temporary table _grp on commit drop as
  with touched as (
    select distinct lemma, root from public.bible_word_tags
     where tagged_at >= since and lemma is not null
  ), tagged as (
    select b.lemma, b.root, b.pos, b.verb_form, b.gloss, b.bible_count, b.bom_count
      from public.bible_word_tags b
      join touched t on t.lemma = b.lemma and t.root is not distinct from b.root
     where b.tagged_at is not null
  ), gloss_ranked as (
    select lemma, root, gloss,
           row_number() over (partition by lemma, root order by count(*) desc, length(gloss)) as rn
      from tagged where gloss is not null and gloss <> ''
     group by lemma, root, gloss
  ), top_glosses as (
    select lemma, root, array_agg(gloss order by rn) as glosses
      from gloss_ranked where rn <= 3 group by lemma, root
  ), heads as (
    select lemma, root,
           (array_agg(pos order by pos))[1] as pos,
           (array_agg(verb_form) filter (where verb_form is not null))[1] as verb_form,
           sum(bible_count + bom_count)::int as occurrences,
           sum(bible_count)::int as bible_occurrences,
           sum(bom_count)::int as bom_occurrences,
           count(*)::int as forms
      from tagged group by lemma, root
  )
  select h.*, coalesce(g.glosses, array[h.lemma]) as glosses
    from heads h left join top_glosses g on g.lemma = h.lemma and g.root is not distinct from h.root;

  create temporary table _match on commit drop as
  select g.lemma as g_lemma, g.root as g_root, d.id
    from _grp g
    cross join lateral (
      select d.id from public.dictionary d
       where d.lemma_key = public.normalize_arabic(g.lemma)
         and d.root is not distinct from g.root
         and (d.pos = g.pos or d.lemma = g.lemma)
       order by (d.lemma = g.lemma) desc, d.occurrences desc
       limit 1
    ) d;

  with up as (
    update public.dictionary d
       set occurrences = g.occurrences,
           bible_occurrences = g.bible_occurrences,
           bom_occurrences = g.bom_occurrences,
           forms = g.forms,
           source = case when g.bible_occurrences > 0 and g.bom_occurrences > 0 then 'both'
                         when g.bom_occurrences > 0 then 'bom' else 'bible' end
      from _match m
      join _grp g on g.lemma = m.g_lemma and g.root is not distinct from m.g_root
     where d.id = m.id and g.occurrences > d.occurrences
    returning 1
  )
  select count(*) into raised from up;

  with ins as (
    insert into public.dictionary
      (lemma, lemma_key, root, root_key, pos, verb_form, glosses, gloss_text,
       occurrences, bible_occurrences, bom_occurrences, forms, source)
    select g.lemma, public.normalize_arabic(g.lemma), g.root,
           case when g.root is null then null else replace(public.normalize_arabic(g.root), '-', '') end,
           g.pos, g.verb_form, g.glosses, array_to_string(g.glosses, '; '),
           g.occurrences, g.bible_occurrences, g.bom_occurrences, g.forms,
           case when g.bible_occurrences > 0 and g.bom_occurrences > 0 then 'both'
                when g.bom_occurrences > 0 then 'bom' else 'bible' end
      from _grp g
     where not exists (select 1 from _match m where m.g_lemma = g.lemma and m.g_root is not distinct from g.root)
    on conflict (lemma, root, pos) do nothing
    returning 1
  )
  select count(*) into inserted from ins;

  return jsonb_build_object('inserted', inserted, 'raised', raised, 'groups', (select count(*) from _grp));
end;
$$;

revoke all on function public.apply_corpus_tags(jsonb) from public, anon, authenticated;
revoke all on function public.sync_dictionary_from_tags(timestamptz) from public, anon, authenticated;
