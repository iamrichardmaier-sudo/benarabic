-- The little animated scene shown with each card's meaning. The value is a
-- key into supabase/functions/_shared/card-scenes.json; the assign-scenes
-- edge function has Claude pick one for every saved card. Until a card has
-- one, the app picks the closest match from the card's English meaning.

alter table public.flashcards add column if not exists scene text;
alter table public.words add column if not exists scene text;

create index if not exists flashcards_scene_pending_idx on public.flashcards (created_at) where scene is null;
create index if not exists words_scene_pending_idx on public.words (created_at) where scene is null;

-- Cards still without a scene, one per distinct (word, meaning), oldest first.
create or replace function public.pending_card_scenes(p_limit int default 40)
returns table (word text, english text, word_type text)
language sql
stable
security definer
set search_path = public
as $$
  select p.word, p.english, max(p.word_type) as word_type
  from (
    select word, english, word_type, created_at from public.flashcards where scene is null
    union all
    select word, english, word_type, created_at from public.words where scene is null
  ) p
  where btrim(p.word) <> ''
  group by p.word, p.english
  order by min(p.created_at)
  limit greatest(p_limit, 1);
$$;

create or replace function public.pending_card_scenes_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from (
    select word, english from public.flashcards where scene is null and btrim(word) <> ''
    union
    select word, english from public.words where scene is null and btrim(word) <> ''
  ) p;
$$;

-- Gives every card with this word and meaning the scene, in both tables.
-- Only cards still without one: a scene already set is never replaced.
create or replace function public.apply_card_scene(p_word text, p_english text, p_scene text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  touched int := 0;
  n int;
begin
  if p_scene is null or btrim(p_scene) = '' then return 0; end if;
  update public.flashcards set scene = p_scene
    where word = p_word and english is not distinct from p_english and scene is null;
  get diagnostics n = row_count;
  touched := touched + n;
  update public.words set scene = p_scene
    where word = p_word and english is not distinct from p_english and scene is null;
  get diagnostics n = row_count;
  return touched + n;
end;
$$;

revoke all on function public.pending_card_scenes(int) from public, anon, authenticated;
revoke all on function public.pending_card_scenes_count() from public, anon, authenticated;
revoke all on function public.apply_card_scene(text, text, text) from public, anon, authenticated;
grant execute on function public.pending_card_scenes(int) to service_role;
grant execute on function public.pending_card_scenes_count() to service_role;
grant execute on function public.apply_card_scene(text, text, text) to service_role;
