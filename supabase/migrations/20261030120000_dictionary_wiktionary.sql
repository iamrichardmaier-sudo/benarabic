-- Wiktionary joins the dictionary.
--
-- Until now every entry came from the tagged scriptures, so the dictionary
-- only knew words that happen to appear there, glossed in context ("she was",
-- "you be"). English Wiktionary's Arabic entries (CC BY-SA 4.0, via the
-- kaikki.org extract) add ~28,000 headwords with real dictionary definitions,
-- roots, verb forms, plurals and gender.
--
-- The scripture rows stay as they are: where Wiktionary has the same word,
-- its definitions are added beside the contextual glosses rather than
-- replacing them, and the word keeps its corpus counts. Words the scriptures
-- never use become new rows with source 'wiktionary'.
--
-- The import itself is data, not schema: scripts/wiktionary/ builds the rows,
-- they are loaded into wiktionary_entries, and merge_wiktionary() folds them
-- into the dictionary. Because the scripture rebuild truncates the dictionary,
-- the staging table is kept so merge_wiktionary() can restore everything after
-- a rebuild.

alter table public.dictionary
  -- Wiktionary's senses, most useful first.
  add column if not exists definitions text[] not null default '{}',
  -- A short headword meaning for a flashcard ("library", "to write").
  add column if not exists headline text,
  -- Plurals, feminine, gender, non-past, verbal noun, participles.
  add column if not exists details jsonb not null default '{}'::jsonb,
  -- The Wiktionary page the entry came from, for attribution.
  add column if not exists wiktionary_page text;

-- Wiktionary keeps a pronoun and a noun spelled alike apart (هُوَ "he" and
-- هُوَ "id"), so the part of speech is part of an entry's identity now.
alter table public.dictionary drop constraint if exists dictionary_lemma_root_key;
alter table public.dictionary drop constraint if exists dictionary_lemma_root_pos_key;
alter table public.dictionary
  add constraint dictionary_lemma_root_pos_key unique nulls not distinct (lemma, root, pos);

create table if not exists public.wiktionary_entries (
  id bigserial primary key,
  lemma text not null,
  root text,
  pos text not null,
  verb_form text,
  definitions text[] not null,
  headline text,
  details jsonb not null default '{}'::jsonb,
  page text not null,
  unique nulls not distinct (lemma, root, pos)
);

-- Staging data, written and read server-side only: no policies at all.
alter table public.wiktionary_entries enable row level security;

-- Which entries describe the same kind of word, for matching across sources.
-- A noun, its adjective use, a participle and a verbal noun are one family:
-- the corpus and Wiktionary often file the same word under different ones.
create or replace function public.dictionary_pos_class(pos text)
returns text
language sql
immutable
as $$
  select case
    when pos in ('noun', 'adjective', 'participle', 'masdar') then 'nominal'
    when pos in ('particle', 'pronoun', 'adverb', 'interjection', 'numeral', 'other') then 'function'
    else coalesce(pos, 'function')
  end
$$;

-- A root reduced to compare across sources: Wiktionary writes hamza as ء, the
-- corpus as أ.
create or replace function public.dictionary_root_match_key(root text)
returns text
language sql
immutable
as $$
  select translate(replace(public.normalize_arabic(root), '-', ''), 'ءؤئ', 'ااا')
$$;

-- Folds wiktionary_entries into the dictionary. Re-runnable: a matched
-- scripture row is updated in place, a new word is upserted.
create or replace function public.merge_wiktionary()
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  n_exact int;
  n_key int;
  n_new int;
begin
  create temp table w on commit drop as
  select e.*,
         public.normalize_arabic(e.lemma) as lemma_key,
         public.dictionary_root_match_key(e.root) as root_match,
         public.dictionary_pos_class(e.pos) as cls,
         false as matched
  from public.wiktionary_entries e;

  create temp table m (did uuid, wid bigint) on commit drop;

  -- 1. Same voweled spelling, same kind of word, roots that agree. Only
  --    one-to-one pairs: an ambiguous match is left as two entries rather
  --    than risk pinning the wrong definitions on a scripture word.
  insert into m
  with cand as (
    select d.id as did, w.id as wid
    from public.dictionary d
    join w on normalize(d.lemma, NFC) = w.lemma
          and public.dictionary_pos_class(d.pos) = w.cls
          and (d.root is null or w.root is null
               or public.dictionary_root_match_key(d.root) = w.root_match)
    where d.source <> 'wiktionary'
  )
  select did, wid from cand c
  where (select count(*) from cand x where x.did = c.did) = 1
    and (select count(*) from cand x where x.wid = c.wid) = 1;
  get diagnostics n_exact = row_count;
  update w set matched = true where id in (select wid from m);

  -- 2. The rest by consonant skeleton (the corpus sometimes drops a final
  --    vowel or writes shadda differently), still one-to-one, and now the
  --    roots must both be known and agree.
  insert into m
  with cand as (
    select d.id as did, w.id as wid
    from public.dictionary d
    join w on d.lemma_key = w.lemma_key
          and public.dictionary_pos_class(d.pos) = w.cls
          and d.root is not null and w.root is not null
          and public.dictionary_root_match_key(d.root) = w.root_match
    where d.source <> 'wiktionary'
      and not w.matched
      and d.id not in (select did from m)
  )
  select did, wid from cand c
  where (select count(*) from cand x where x.did = c.did) = 1
    and (select count(*) from cand x where x.wid = c.wid) = 1;
  get diagnostics n_key = row_count;
  update w set matched = true where id in (select wid from m);

  update public.dictionary d
  set definitions = w.definitions,
      headline = w.headline,
      details = w.details,
      wiktionary_page = w.page,
      root = coalesce(d.root, w.root),
      root_key = coalesce(d.root_key, replace(public.normalize_arabic(w.root), '-', '')),
      verb_form = coalesce(d.verb_form, w.verb_form),
      gloss_text = concat_ws('; ', nullif(array_to_string(d.glosses, '; '), ''), w.headline,
                             array_to_string(w.definitions, '; '))
  from m join w on w.id = m.wid
  where d.id = m.did;

  insert into public.dictionary
    (lemma, lemma_key, root, root_key, pos, verb_form, glosses, gloss_text,
     definitions, headline, details, wiktionary_page, occurrences, source)
  select w.lemma, w.lemma_key, w.root,
         case when w.root is null then null else replace(public.normalize_arabic(w.root), '-', '') end,
         w.pos, w.verb_form,
         w.definitions[1:4],
         concat_ws('; ', w.headline, array_to_string(w.definitions, '; ')),
         w.definitions, w.headline, w.details, w.page, 0, 'wiktionary'
  from w
  where not w.matched
  on conflict (lemma, root, pos) do update
    set definitions = excluded.definitions,
        headline = excluded.headline,
        details = excluded.details,
        wiktionary_page = excluded.wiktionary_page,
        glosses = case when public.dictionary.source = 'wiktionary'
                       then excluded.glosses else public.dictionary.glosses end,
        gloss_text = case when public.dictionary.source = 'wiktionary'
                          then excluded.gloss_text
                          else concat_ws('; ', array_to_string(public.dictionary.glosses, '; '),
                                         excluded.gloss_text) end;
  get diagnostics n_new = row_count;

  return jsonb_build_object('matched_exact', n_exact, 'matched_skeleton', n_key, 'added', n_new);
end;
$$;

revoke all on function public.merge_wiktionary() from public, anon, authenticated;

-- Dictionary search, ranked.
--
-- With ~30,000 entries a plain "contains" match ordered by scripture counts
-- buries the answer: "house" would list "warehouse" and every word whose
-- third sense mentions a house before بَيْت. So: the headword meaning first,
-- then any sense that is exactly the query, then a whole-word match, then
-- anything containing it; and within each, words the scriptures use, then
-- entries with real definitions, then shorter words.
create or replace function public.search_dictionary(p_query text, p_limit int default 30)
returns setof public.dictionary
language sql
stable
set search_path = public
as $$
  with q as (
    select btrim(p_query) as raw,
           public.normalize_arabic(btrim(p_query)) as ar,
           lower(btrim(p_query)) as en,
           btrim(p_query) ~ '[؀-ۿ]' as is_ar
  ),
  q2 as (
    select q.*,
           replace(replace(replace(q.en, '\', '\\'), '%', '\%'), '_', '\_') as en_like,
           replace(replace(replace(q.ar, '\', '\\'), '%', '\%'), '_', '\_') as ar_like,
           regexp_replace(q.en, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') as en_re
    from q
    where length(q.raw) >= 2
  )
  select d.*
  from public.dictionary d, q2
  where (q2.is_ar and d.lemma_key like '%' || q2.ar_like || '%')
     or (not q2.is_ar and d.gloss_text ilike '%' || q2.en_like || '%')
  order by
    case
      when q2.is_ar then
        case when d.lemma_key = q2.ar then 0
             when d.lemma_key like q2.ar_like || '%' then 1
             else 2 end
      else
        case when lower(regexp_replace(coalesce(d.headline, d.glosses[1], ''), '\([^)]*\)', '', 'g'))
                    ~ ('^\s*(to |a |an |the )?' || q2.en_re || '\s*($|[,;])') then 0
             when exists (
               select 1 from unnest(d.definitions || d.glosses) g
               where lower(regexp_replace(g, '\([^)]*\)', '', 'g'))
                     ~ ('(^|[,;]\s*)(to |a |an |the )?' || q2.en_re || '\s*($|[,;])')
             ) then 1
             when d.gloss_text ~* ('\m' || q2.en_re || '\M') then 2
             else 3 end
    end,
    (d.pos = 'proper_noun'),
    d.occurrences desc,
    (d.wiktionary_page is null),
    length(d.lemma_key),
    d.lemma
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

grant execute on function public.search_dictionary(text, int) to authenticated;
