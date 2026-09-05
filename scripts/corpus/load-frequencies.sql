-- Load a work's word list and token counts into public.bible_word_tags.
--
-- Run from the SQL editor, not from CI. The counts are produced locally by
-- scripts/corpus/word-frequencies.py and then read back over HTTP from a
-- pinned commit, because the database can reach GitHub and the machine
-- running the tagging cannot reach the database. Pin a *commit SHA*, never a
-- branch: raw.githubusercontent serves branch URLs from a cache that has
-- handed back a stale file before.
--
-- Substitute <sha> and pick the pair of columns for the work being loaded.

select http_set_curlopt('CURLOPT_TIMEOUT_MS', '120000');

create temporary table freq_raw (body text);
insert into freq_raw
select content from http_get(
  'https://raw.githubusercontent.com/iamrichardmaier-sudo/benarabic/<sha>/scripts/bom/bom-frequencies.json'
);

with pairs as (
  select key as surface, value::int as n
  from freq_raw, jsonb_each_text(body::jsonb)
)
insert into public.bible_word_tags (surface, in_bom, bom_count)
select surface, true, n from pairs
on conflict (surface) do update
  set in_bom = true, bom_count = excluded.bom_count;

-- The Bible pass only fills counts in: its rows were written by the tagging
-- pipeline and a form the pipeline never reached is not a row worth creating
-- empty.
with pairs as (
  select key as surface, value::int as n
  from freq_raw, jsonb_each_text(body::jsonb)
)
update public.bible_word_tags t set bible_count = p.n, in_bible = true
from pairs p where t.surface = p.surface;
