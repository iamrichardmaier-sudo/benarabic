-- XP per day, for the daily goal on Home and the study streak (with its
-- freezes). Kept here rather than on one device so that days studied on the
-- iOS widget count toward both.
--
-- `day` is the learner's own calendar day, sent by the client: a day is when
-- the learner thinks it is, not midnight UTC, or a late-evening review in
-- America would land on tomorrow.

create table if not exists public.user_study_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  xp integer not null default 0 check (xp >= 0),
  primary key (user_id, day)
);

alter table public.user_study_days enable row level security;

drop policy if exists "Learners read their own study days" on public.user_study_days;
create policy "Learners read their own study days"
  on public.user_study_days for select
  to authenticated
  using (auth.uid() = user_id);

-- add_xp gains the day it was earned on. The old one-argument version is
-- dropped first: keeping both would make a call with only `amount` ambiguous.
-- Clients that still send only `amount` (an older widget) get today's date.
drop function if exists public.add_xp(integer);

create or replace function public.add_xp(amount integer, study_day date default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  delta integer := greatest(0, least(coalesce(amount, 0), 2000));
  d date := current_date;
  total integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  -- XP queued offline is sent later with the day it was earned; accept the
  -- last month of days, and a day ahead for time zones east of UTC.
  if study_day is not null and study_day between current_date - 31 and current_date + 1 then
    d := study_day;
  end if;

  insert into public.user_progress (user_id, xp)
  values (uid, delta)
  on conflict (user_id) do update
    set xp = public.user_progress.xp + excluded.xp,
        updated_at = now()
  returning xp into total;

  insert into public.user_study_days (user_id, day, xp)
  values (uid, d, delta)
  on conflict (user_id, day) do update
    set xp = public.user_study_days.xp + excluded.xp;

  return total;
end;
$$;

revoke all on function public.add_xp(integer, date) from public, anon;
grant execute on function public.add_xp(integer, date) to authenticated;
