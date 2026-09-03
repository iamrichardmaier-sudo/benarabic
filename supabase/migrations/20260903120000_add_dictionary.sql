-- A shared, read-only dictionary the whole app can search.
--
-- Built from the tagged Bible corpus rather than from anyone's flashcards.
-- The corpus is already shared, non-personal reference data, whereas
-- `flashcards` is RLS-scoped per user: pooling it would make one learner's
-- private deck searchable by everyone else. Contributing your own words is a
-- deliberate opt-in, not something to switch on by accident.

-- Mirrors normalizeArabic() in src/lib/arabic-normalize.ts. Keep the two in
-- step: a search box that normalises differently to the column it queries
-- silently stops matching. Four alef variants → ا, ة → ه, ى → ي, and all
-- tashkeel and tatweel stripped.
create or replace function public.normalize_arabic(input text)
returns text
language sql
immutable
strict
as $$
  select regexp_replace(
           translate(
             regexp_replace(input, '[ً-ٰٟـ]', '', 'g'),
             'أإآٱةى', 'ااااهي'
           ),
           '\s+', ' ', 'g'
         )
$$;

create table if not exists public.dictionary (
  id uuid primary key default gen_random_uuid(),
  lemma text not null,
  -- Consonant skeleton, so a learner who types what they hear still matches.
  lemma_key text not null,
  root text,
  root_key text,
  pos text,
  verb_form text,
  -- Several attested senses rather than one invented headword gloss: these
  -- come from running text, where a word is glossed in context.
  glosses text[] not null default '{}',
  -- The same glosses flattened, so one ILIKE serves the English search.
  gloss_text text not null default '',
  occurrences integer not null default 0,
  source text not null default 'bible',
  created_at timestamptz not null default now(),
  unique (lemma, root)
);

create index if not exists dictionary_lemma_key_idx on public.dictionary (lemma_key text_pattern_ops);
create index if not exists dictionary_root_key_idx on public.dictionary (root_key);
create index if not exists dictionary_occurrences_idx on public.dictionary (occurrences desc);

alter table public.dictionary enable row level security;

-- Readable by anyone signed in; writable by nobody through the API. It is
-- reference data, rebuilt server-side, not user content.
drop policy if exists "Dictionary is readable by signed-in users" on public.dictionary;
create policy "Dictionary is readable by signed-in users"
  on public.dictionary for select
  to authenticated
  using (true);

-- Populate from the corpus. Re-runnable: truncate and rebuild, since every row
-- is derived rather than authored.
truncate public.dictionary;

with tagged as (
  select coalesce(lemma, surface) as lemma, root, pos, verb_form, gloss
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
         count(*)::int as occurrences
  from tagged
  group by lemma, root
)
insert into public.dictionary
  (lemma, lemma_key, root, root_key, pos, verb_form, glosses, gloss_text, occurrences, source)
select h.lemma,
       public.normalize_arabic(h.lemma),
       h.root,
       case when h.root is null then null
            else replace(public.normalize_arabic(h.root), '-', '') end,
       h.pos, h.verb_form,
       g.glosses,
       array_to_string(g.glosses, '; '),
       h.occurrences,
       'bible'
from heads h
join top_glosses g on g.lemma = h.lemma and g.root is not distinct from h.root;
