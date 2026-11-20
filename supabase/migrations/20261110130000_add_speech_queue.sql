-- Banking audio ahead of need.
--
-- generate-speech makes a clip the first time a line is heard and keeps it in
-- the word-audio bucket. That is fine while there is a voice service to ask;
-- this is for making everything worth having BEFORE there is not one. The
-- queue lists every line the app can say, in the order it matters, and
-- scripts/audio/bank.mjs works through whatever is not yet in word_audio.

-- A card field as it is said: the first form only, without a plural note or a
-- feminine ending. Must agree with speakable() in src/lib/speech.ts, since the
-- clip is found again by the exact text.
create or replace function public.speakable(t text) returns text
language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(
    (regexp_split_to_array(coalesce(t, ''), '\s+/\s+|\s+ج\.\s*|\s+—\s+'))[1],
    '/\s*ة', '', 'g'), 'ـ+', '', 'g'))
$$;

-- The name generate-speech stores a clip under: sha256 of voice, NUL, text.
create or replace function public.speech_key(voice text, t text) returns text
language sql immutable as $$
  select encode(sha256(convert_to(voice, 'UTF8') || '\x00'::bytea || convert_to(t, 'UTF8')), 'hex')
$$;

create table if not exists public.speech_queue (
  text_key text primary key,
  tier integer not null,
  voice text not null,
  line text not null,
  source text not null
);
alter table public.speech_queue enable row level security;
-- No policies: read only through pending_speech(), which wants the token.

create table if not exists public.speech_bank_config (
  token text primary key
);
alter table public.speech_bank_config enable row level security;

-- (Re)build the queue from what is in the database now. Lower tiers are
-- inserted first and win, so a word in the deck and in the bank is tier 1.
create or replace function public.fill_speech_queue() returns table (tier integer, lines bigint, chars bigint)
language plpgsql security definer set search_path = public as $$
begin
  create temp table _lines (tier integer, voice text, line text, source text) on commit drop;

  -- 1: the deck's words and their forms
  insert into _lines select 1, 'ar', speakable(coalesce(nullif(word_voweled, ''), word)), 'card word' from flashcards where word_type is distinct from 'sentence';
  insert into _lines select 1, 'ar', speakable(v), 'card form' from flashcards, unnest(array[fusha_plural, past_tense, present_tense, masdar_form]) v where v is not null;
  insert into _lines select 1, 'ar', speakable(f->>'form'), 'card family' from flashcards, jsonb_array_elements(case when jsonb_typeof(companion_forms::jsonb) = 'array' then companion_forms::jsonb else '[]'::jsonb end) f;
  -- 2: Shaami forms
  insert into _lines select 2, 'ar-shami', speakable(v), 'card shaami' from flashcards, unnest(array[shaami, shaami_plural]) v where v is not null;
  -- 3: the deck's sentences
  insert into _lines select 3, 'ar', btrim(quran_example), 'card example' from flashcards where quran_example is not null;
  insert into _lines select 3, 'ar', speakable(word), 'sentence card' from flashcards where word_type = 'sentence';
  -- 5: every verb's principal parts
  insert into _lines select 5, 'ar', speakable(v), 'verb' from verb_conjugations, unnest(array[past, present, masdar]) v where v is not null;
  -- 6: English, for the Listen loop
  insert into _lines select 6, 'en', btrim(english), 'card english' from flashcards where english is not null and word_type is distinct from 'sentence';
  -- 7: the shared word bank, so a word added later already has a voice
  insert into _lines select 7, 'ar', speakable(coalesce(nullif(word_voweled, ''), word)), 'bank word' from words where word_type is distinct from 'sentence';
  insert into _lines select 7, 'ar-shami', speakable(v), 'bank shaami' from words, unnest(array[shaami, shaami_plural, shaami_sentence]) v where v is not null;
  insert into _lines select 7, 'ar', btrim(fusha_sentence), 'bank sentence' from words where fusha_sentence is not null;
  -- 8: the bank's example sentences
  insert into _lines select 8, 'ar', btrim(quran_example), 'bank example' from words where quran_example is not null;

  insert into speech_queue (text_key, tier, voice, line, source)
  select distinct on (speech_key(l.voice, l.line)) speech_key(l.voice, l.line), l.tier, l.voice, l.line, l.source
  from _lines l
  where l.line <> '' and length(l.line) <= 400
    and (l.voice = 'en' or l.line ~ '[ء-ي]')
  order by speech_key(l.voice, l.line), l.tier
  on conflict (text_key) do update set tier = least(speech_queue.tier, excluded.tier);

  return query select q.tier, count(*), sum(length(q.line))::bigint from speech_queue q group by q.tier order by q.tier;
end $$;
revoke all on function public.fill_speech_queue() from public, anon, authenticated;

-- What is still to be made, for the banking script. The token keeps the list
-- (which holds learners' words) from being read with the public key alone.
create or replace function public.pending_speech(p_token text, p_max_tier integer default 99)
returns table (tier integer, voice text, line text)
language sql security definer set search_path = public as $$
  select q.tier, q.voice, q.line
  from speech_queue q
  where exists (select 1 from speech_bank_config c where c.token = p_token)
    and q.tier <= p_max_tier
    and not exists (select 1 from word_audio a where a.text_key = q.text_key)
  order by q.tier, length(q.line), q.text_key
$$;
grant execute on function public.pending_speech(text, integer) to anon, authenticated;
