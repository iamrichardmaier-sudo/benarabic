-- private_texts already held a reader's own text, scoped to that reader by
-- RLS. It gains the things a library entry needs to be findable and to look
-- like something: a name, and a cover.
--
-- Covers are stored per reader rather than shipped with the app on purpose.
-- A cover is usually someone else's artwork, and the app's own build is
-- published publicly; a reader's own copy of it belongs in their own row.

alter table public.private_texts
  add column if not exists title text,
  add column if not exists cover_url text,
  add column if not exists body text,
  add column if not exists kind text not null default 'text';

comment on column public.private_texts.title is
  'What the reader called this entry; shown in the library list.';
comment on column public.private_texts.cover_url is
  'Cover art for the entry, supplied by the reader — usually a data URL of a file from their own device. Never shipped with the app.';
comment on column public.private_texts.body is
  'Plain text of a free-form entry. The older verses column stays for chapter-and-verse works.';
comment on column public.private_texts.kind is
  'What shape the entry is: "text" for something pasted in, "chapters" for a work with verses.';

-- Entries are listed newest first in the library.
create index if not exists private_texts_by_reader_idx
  on public.private_texts (user_id, updated_at desc);
