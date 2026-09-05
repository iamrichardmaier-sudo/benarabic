-- Which work a tagged word comes from, and how often it appears in each.
--
-- `bible_word_tags` was a Bible-only table: one row per distinct surface form,
-- and membership was implicit. The Book of Mormon shares most of its
-- vocabulary with the Bible but not all of it, so the question "where does
-- this word occur?" now has three answers, not two. Flags rather than a single
-- `source` column, because for 1,671 forms the honest answer is *both* and a
-- single column would force a lie.
alter table public.bible_word_tags
  add column if not exists in_bible boolean not null default false,
  add column if not exists in_bom boolean not null default false,
  add column if not exists bible_count integer not null default 0,
  add column if not exists bom_count integer not null default 0;

-- Everything that existed before this migration came from the Bible.
update public.bible_word_tags set in_bible = true where not in_bible and not in_bom;

create index if not exists bible_word_tags_in_bom_idx on public.bible_word_tags (in_bom) where in_bom;

comment on column public.bible_word_tags.bible_count is
  'Times this surface form occurs in the Bible text, not the number of forms.';
comment on column public.bible_word_tags.bom_count is
  'Times this surface form occurs in the Book of Mormon text.';
