-- Reading texts that belong to one reader rather than to the app.
--
-- The Bible ships as static JSON in public/bible, because the Van Dyke Arabic
-- and the KJV English are both public domain. Not every text a learner wants
-- to read is: a licensed edition may be theirs to read and not theirs to
-- redistribute. Those live here instead — row-level security scopes every row
-- to the user who loaded it, so the text never enters the repository, the
-- built bundle, or the shared dictionary.
create table if not exists public.private_texts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  -- Which work this chapter belongs to, e.g. 'bom'. Keeps the table open to
  -- a second private text without another migration.
  work text not null,
  book_code text not null,
  chapter integer not null,
  -- The same [{v, a, e}] shape the Bible chapters use, so one reader and one
  -- parallel view serve both.
  verses jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, work, book_code, chapter)
);

create index if not exists private_texts_lookup_idx
  on public.private_texts (user_id, work, book_code, chapter);

alter table public.private_texts enable row level security;

drop policy if exists "Readers see only their own texts" on public.private_texts;
create policy "Readers see only their own texts"
  on public.private_texts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Readers load their own texts" on public.private_texts;
create policy "Readers load their own texts"
  on public.private_texts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Readers replace their own texts" on public.private_texts;
create policy "Readers replace their own texts"
  on public.private_texts for update
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Readers remove their own texts" on public.private_texts;
create policy "Readers remove their own texts"
  on public.private_texts for delete
  to authenticated
  using (auth.uid() = user_id);
