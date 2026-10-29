-- The flashcard script travels with the account, like the background.
--
-- Until now the chosen script lived only in the browser's localStorage, so the
-- iOS widget could not know it and a second device started back at Naskh. It
-- sits beside `background` because both are the same kind of thing: a reward
-- unlocked by level and chosen by the learner. As with the background, the
-- unlock is checked by whoever reads it (the app and the widget both know the
-- level table); here a script is just a short id, and an id above the
-- learner's level is shown as Naskh.

alter table public.user_progress add column if not exists card_font text;

create or replace function public.set_card_font(font_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if font_id is not null and font_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'invalid font id';
  end if;
  insert into public.user_progress (user_id, card_font)
  values (uid, font_id)
  on conflict (user_id) do update
    set card_font = excluded.card_font,
        updated_at = now();
end;
$$;

revoke all on function public.set_card_font(text) from public, anon;
grant execute on function public.set_card_font(text) to authenticated;
