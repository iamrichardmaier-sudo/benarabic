-- Lets one saved text be shared with every signed-in reader, the same way a
-- deck can be marked public. Only SELECT is broadened: only the owner can
-- still insert/update/delete a text, since only the admin account curates
-- public articles today.

alter table public.private_texts
  add column is_public boolean not null default false;

drop policy "Readers see only their own texts" on public.private_texts;

create policy "Readers see their own texts and public ones"
  on public.private_texts for select
  using (auth.uid() = user_id or is_public = true);
