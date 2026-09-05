-- The dictionary now spans both works, and counts words rather than spellings.
--
-- Two changes, both because the Book of Mormon joined the corpus:
--
-- 1. `occurrences` was `count(*)` over tagged rows — one row per distinct
--    surface form — so it counted *spellings*, not appearances, while the UI
--    rendered it as "N× in the Bible". Now that every form carries a real
--    token count per work, the number can mean what it says.
-- 2. A word can be attested in one work, the other, or both. `source` says
--    which, and the per-work counts let a reader see the split.
alter table public.dictionary
  add column if not exists bible_occurrences integer not null default 0,
  add column if not exists bom_occurrences integer not null default 0,
  -- Distinct inflected spellings behind the entry: what `occurrences` used to
  -- hold, kept because it is a genuinely interesting number on its own.
  add column if not exists forms integer not null default 0;

comment on column public.dictionary.occurrences is
  'Times the word appears in the corpus, across both works.';

truncate public.dictionary;

with tagged as (
  select coalesce(lemma, surface) as lemma, root, pos, verb_form, gloss,
         bible_count, bom_count
  from public.bible_word_tags
  where tagged_at is not null
),
-- One lemma carries several contextual readings ("he was born", "you be
-- born"). Keep the few most frequent rather than inventing a single headword
-- gloss the corpus cannot support.
gloss_ranked as (
  select lemma, root, gloss, count(*) as n,
         row_number() over (partition by lemma, root order by count(*) desc, length(gloss)) as rn
  from tagged
  where gloss is not null and gloss <> ''
  group by lemma, root, gloss
),
top_glosses as (
  select lemma, root, array_agg(gloss order by rn) as glosses
  from gloss_ranked where rn <= 3
  group by lemma, root
),
heads as (
  select lemma, root,
         (array_agg(pos order by pos))[1] as pos,
         (array_agg(verb_form) filter (where verb_form is not null))[1] as verb_form,
         count(*)::int as forms,
         sum(bible_count)::int as bible_occurrences,
         sum(bom_count)::int as bom_occurrences
  from tagged
  group by lemma, root
)
insert into public.dictionary
  (lemma, lemma_key, root, root_key, pos, verb_form, glosses, gloss_text,
   occurrences, bible_occurrences, bom_occurrences, forms, source)
select h.lemma,
       public.normalize_arabic(h.lemma),
       h.root,
       case when h.root is null then null
            else replace(public.normalize_arabic(h.root), '-', '') end,
       h.pos, h.verb_form,
       g.glosses,
       array_to_string(g.glosses, '; '),
       h.bible_occurrences + h.bom_occurrences,
       h.bible_occurrences,
       h.bom_occurrences,
       h.forms,
       case when h.bible_occurrences > 0 and h.bom_occurrences > 0 then 'both'
            when h.bom_occurrences > 0 then 'bom'
            else 'bible' end
-- An entry the corpus never glosses would be a headword with no meaning, so
-- the join is deliberately an inner one: root-only rows stay in the tag table,
-- where the reader can still use them, and out of the dictionary.
from heads h
join top_glosses g on g.lemma = h.lemma and g.root is not distinct from h.root;
