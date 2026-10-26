-- Levels and backgrounds: each learner's XP total and chosen background.
--
-- XP is earned by grading cards in the web app (review, practice, learn) and in
-- the iOS Scriptable widget, so it lives here rather than on one device. Both
-- add to it only through add_xp(), which does the addition inside the database
-- in one statement: two clients granting XP at the same moment can never
-- overwrite each other's points, which a read-then-write from the client
-- could.
--
-- The level is not stored. It is derived from xp by the same table of
-- thresholds in the app (src/lib/levels.ts) and the widget, so changing the
-- curve never needs a data migration.

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  xp integer not null default 0 check (xp >= 0),
  -- Id of the chosen background (src/components/backgrounds); null = the
  -- default plain one.
  background text,
  updated_at timestamptz not null default now()
);

alter table public.user_progress enable row level security;

-- Readable by its owner only. There is deliberately no insert/update policy:
-- every write goes through the two functions below, so a client cannot set
-- an arbitrary XP total with a plain PATCH.
drop policy if exists "Learners read their own progress" on public.user_progress;
create policy "Learners read their own progress"
  on public.user_progress for select
  to authenticated
  using (auth.uid() = user_id);

-- Adds XP for the signed-in learner and returns the new total.
-- One call per graded card or per finished session; anything above 2000 in a
-- single call is clamped, which is far more than a real session earns.
create or replace function public.add_xp(amount integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  delta integer := greatest(0, least(coalesce(amount, 0), 2000));
  total integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  insert into public.user_progress (user_id, xp)
  values (uid, delta)
  on conflict (user_id) do update
    set xp = public.user_progress.xp + excluded.xp,
        updated_at = now()
  returning xp into total;
  return total;
end;
$$;

-- Chooses a background. Unlocking is checked in the app (it knows the level
-- thresholds); here a background is just a short id.
create or replace function public.set_background(background_id text)
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
  if background_id is not null and background_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'invalid background id';
  end if;
  insert into public.user_progress (user_id, background)
  values (uid, background_id)
  on conflict (user_id) do update
    set background = excluded.background,
        updated_at = now();
end;
$$;

revoke all on function public.add_xp(integer) from public, anon;
revoke all on function public.set_background(text) from public, anon;
grant execute on function public.add_xp(integer) to authenticated;
grant execute on function public.set_background(text) to authenticated;
