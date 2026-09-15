-- A saved entry can hold an English rendering alongside the Arabic, one line
-- per line, so the reader can show or hide it the way the Bible reader does.
--
-- Supplied by the reader, not shipped with the app: an entry's text is usually
-- someone else's writing, and so is any translation of it.
alter table public.private_texts
  add column if not exists english text;

comment on column public.private_texts.english is
  'The reader''s own English for this entry, one line per line of the body. Null when they have not added one.';
