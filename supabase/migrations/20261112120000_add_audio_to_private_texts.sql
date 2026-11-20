-- A saved text can carry a narration: an MP3 in the private text-audio
-- bucket, and the time each word is spoken, so the reader can highlight the
-- word being read. audio_words is [{ "i": <word index in body>, "s": <start
-- seconds>, "e": <end seconds> }], indexed over the body's words in order.
alter table public.private_texts
  add column if not exists audio_path text,
  add column if not exists audio_words jsonb;

-- Narrations are the reader's own copy of someone else's writing, so the
-- bucket is private: each reader can read the files under their own id.
-- Files are written by the service role.
insert into storage.buckets (id, name, public)
values ('text-audio', 'text-audio', false)
on conflict (id) do nothing;

drop policy if exists "Readers can play their own text audio" on storage.objects;
create policy "Readers can play their own text audio"
  on storage.objects for select to authenticated
  using (bucket_id = 'text-audio' and (storage.foldername(name))[1] = auth.uid()::text);
