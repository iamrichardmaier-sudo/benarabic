-- Caches generated "Listen to cards" audio so the same word is never sent
-- to ElevenLabs twice. Keyed by text rather than by a word-bank id, since
-- not every flashcard is linked to the shared `words` table (cards added
-- via "Add Words" or the create_flashcard MCP tool store their own text
-- directly and have no word_id at all).

create table public.word_audio (
  text_key text primary key,   -- sha256 hex of `${voice}\0${text.trim()}`
  voice text not null,          -- 'ar' | 'en' -- for humans reading the table
  source_text text not null,    -- the exact text spoken -- for humans reading the table
  audio_url text not null,      -- public URL in the word-audio bucket
  created_at timestamptz not null default now()
);

alter table public.word_audio enable row level security;
-- No policies: this table is never read or written by client code, only
-- by generate-speech via its service-role key, which bypasses RLS anyway.
-- Enabling RLS with zero policies is the correct locked-down default.

insert into storage.buckets (id, name, public) values ('word-audio', 'word-audio', true);

create policy "Word audio is world readable"
  on storage.objects for select
  using (bucket_id = 'word-audio');
