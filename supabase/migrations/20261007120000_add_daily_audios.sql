-- Daily Audios: one Pimsleur-style lesson per day, published by an automated
-- job that runs outside this repo. It uploads the MP3 and its cover art to the
-- two buckets below and inserts one row here; the app lists whatever rows
-- exist, newest first, so a new episode needs no code change or redeploy.

create table public.daily_audios (
  id uuid primary key default gen_random_uuid(),
  audio_date date not null unique,   -- one episode per day, e.g. 2026-10-08
  title text not null,               -- e.g. 'Oct 8 — At the Clothing Shop'
  audio_url text not null,           -- public URL of the MP3 in daily-audio
  image_url text,                    -- public URL of the cover in daily-audio-art
  duration_secs integer,
  created_at timestamptz not null default now()
);

alter table public.daily_audios enable row level security;

-- Anyone can read. There are deliberately no insert/update/delete policies:
-- only the publisher's service-role key writes, and it bypasses RLS.
create policy "Daily audios are world readable"
  on public.daily_audios for select
  to anon, authenticated
  using (true);

insert into storage.buckets (id, name, public) values
  ('daily-audio', 'daily-audio', true),
  ('daily-audio-art', 'daily-audio-art', true)
on conflict (id) do nothing;

create policy "Daily audio is world readable"
  on storage.objects for select
  using (bucket_id = 'daily-audio');

create policy "Daily audio art is world readable"
  on storage.objects for select
  using (bucket_id = 'daily-audio-art');
