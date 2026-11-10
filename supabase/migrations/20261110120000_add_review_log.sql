-- One row per graded answer. Until now a card kept only its current schedule
-- (interval, ease, due date), which says where it is and nothing about how it
-- got there: no retention rate, no count of how often a word was forgotten.
-- This is the history those are worked out from.
--
-- card_id is text with no foreign key on purpose: the history of a card
-- should outlive the card (a deleted word still counted toward last month's
-- reviews), and ear-training items that are not cards log here too.

create table public.review_log (
  id uuid primary key,                       -- made on the device, so a replayed write cannot double-count
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id text not null,
  reviewed_at timestamptz not null default now(),
  -- 'review' a timed review, 'ladder' a first-week rep, and the practice
  -- modes that grade an answer without rescheduling the card.
  kind text not null check (kind in ('review', 'ladder', 'cloze', 'listen', 'dictation', 'pairs')),
  rating text not null check (rating in ('again', 'hard', 'good', 'easy')),
  interval_before integer,
  interval_after integer
);

create index review_log_user_time on public.review_log (user_id, reviewed_at desc);

alter table public.review_log enable row level security;

create policy "Learners read their own review history"
  on public.review_log for select
  using (auth.uid() = user_id);

create policy "Learners add to their own review history"
  on public.review_log for insert
  with check (auth.uid() = user_id);
