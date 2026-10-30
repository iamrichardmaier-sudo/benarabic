-- Daily translation practice: three hard English sentences a day, built from
-- the learner's newest words, and every attempt at translating them with the
-- feedback it got.
--
-- The `translation-practice` edge function writes both tables with the
-- learner's own sign-in, so the policies below are all it needs. A learner can
-- also mark an attempt's feedback as wrong (`flagged`) straight from the app.

create table if not exists public.translation_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  position smallint not null check (position between 1 and 3),
  english text not null,
  -- The grammar the sentence is built to test, e.g. "counterfactual لو".
  grammar_focus text not null default '',
  -- The learner's words the sentence was built around.
  target_words jsonb not null default '[]'::jsonb,
  -- Several different correct translations: grading compares against these
  -- rather than inventing a "right answer" from scratch.
  reference_translations jsonb not null default '[]'::jsonb,
  -- Mistakes a learner is likely to make on this sentence.
  pitfalls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, day, position)
);

create table if not exists public.translation_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id uuid not null references public.translation_challenges(id) on delete cascade,
  attempt text not null,
  feedback jsonb not null,
  flagged boolean not null default false,
  flag_note text,
  created_at timestamptz not null default now()
);

create index if not exists translation_attempts_user_created
  on public.translation_attempts (user_id, created_at desc);

alter table public.translation_challenges enable row level security;
alter table public.translation_attempts enable row level security;

drop policy if exists "Learners read their own challenges" on public.translation_challenges;
create policy "Learners read their own challenges"
  on public.translation_challenges for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Learners add their own challenges" on public.translation_challenges;
create policy "Learners add their own challenges"
  on public.translation_challenges for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Learners read their own attempts" on public.translation_attempts;
create policy "Learners read their own attempts"
  on public.translation_attempts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Learners add their own attempts" on public.translation_attempts;
create policy "Learners add their own attempts"
  on public.translation_attempts for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.translation_challenges c
      where c.id = challenge_id and c.user_id = auth.uid()
    )
  );

-- Only the flag can change after the fact; the attempt and its feedback stay
-- as they were graded.
drop policy if exists "Learners flag their own attempts" on public.translation_attempts;
create policy "Learners flag their own attempts"
  on public.translation_attempts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke update on public.translation_attempts from authenticated;
grant update (flagged, flag_note) on public.translation_attempts to authenticated;
