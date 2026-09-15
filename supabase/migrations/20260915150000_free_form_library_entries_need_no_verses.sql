-- verses was required back when every private text was a chapter of a work.
-- A pasted entry has a body instead and nothing to put here, so saving one
-- failed on the not-null constraint. An empty array is the honest value for
-- "this entry has no verses", and it keeps the column meaningful for the
-- chapter-and-verse side.
alter table public.private_texts
  alter column verses set default '[]'::jsonb;

-- Words tagged out of the entry's own text, keyed by consonant skeleton.
--
-- They live on the row rather than in the shared word tables on purpose: the
-- shared index is a build artifact derived from scripture and regenerated at
-- deploy time, so a word tagged now could never appear in it, and colloquial
-- words from a reader's own text do not belong in a scripture-derived index
-- anyway. Here they travel with the text they came from.
alter table public.private_texts
  add column if not exists word_tags jsonb not null default '{}'::jsonb;

comment on column public.private_texts.word_tags is
  'Senses for the words of this entry, keyed by consonant skeleton. Tagged from the reader''s own text when they save it.';
