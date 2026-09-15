-- The front-loaded phase a newly-graduated card runs before it joins the
-- long-term rotation: four reps a day for three days, two a day for two more,
-- spaced a few hours apart, then plain SM-2 as before.
--
-- Cards already in the long-term rotation keep intensive_day null and are
-- completely unaffected — nothing about their schedule changes.

alter table public.flashcards
  add column if not exists intensive_day smallint,
  add column if not exists intensive_reps_done smallint not null default 0,
  add column if not exists next_review_at timestamptz;

comment on column public.flashcards.intensive_day is
  '1-based day of the front-loaded review phase, or null once the card has joined the long-term rotation.';
comment on column public.flashcards.intensive_reps_done is
  'Reps already completed on the current day of the front-loaded phase.';
comment on column public.flashcards.next_review_at is
  'The moment the next rep is wanted, when it falls later the same day. Null means next_review_date alone decides, which is how every card outside the phase works.';

alter table public.flashcards
  add constraint flashcards_intensive_day_range
  check (intensive_day is null or (intensive_day >= 1 and intensive_day <= 5));

-- The review queue reads "due on or before today, and the gap has run out".
create index if not exists flashcards_due_idx
  on public.flashcards (user_id, next_review_date, next_review_at)
  where learning_stage = 'graduated';
