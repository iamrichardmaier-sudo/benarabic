-- The verbs behind the "Conjugate" button on the back of a card.
--
-- One row per verb: its principal parts, masdar and the English of its two
-- participles (written by hand, with whether each participle is actually
-- used). The full table is worked out from these by src/lib/verb-table.ts in
-- the app and by its copy in the Scriptable widget, so a row stays small and a
-- correction is made in one place. `charts` holds hand-written forms that
-- replace worked-out ones (لَيْسَ, which no paradigm produces).
--
-- The rows are reference data shared by every learner: anyone signed in may
-- read them, and they are written only by migrations and the service role.
-- The data itself lives in supabase/verb-entries.json.

create table if not exists public.verb_entries (
  key text primary key,
  root text not null,
  form text not null,
  past text not null,
  present text not null default '',
  masdar text,
  english text,
  prefix text,
  active_present text,
  active_en text,
  active_exists boolean not null default true,
  passive_en text,
  passive_exists boolean not null default true,
  charts jsonb,
  updated_at timestamptz not null default now()
);

alter table public.verb_entries enable row level security;

drop policy if exists "Signed-in users read verb entries" on public.verb_entries;
create policy "Signed-in users read verb entries"
  on public.verb_entries for select
  to authenticated
  using (true);

-- Which verbs a card's table shows: a verb card's own verb, or the verbs a
-- participle or masdar comes from. Empty or null means no Conjugate button,
-- except on a verb card, whose table the app can still work out from the
-- card's own principal parts.
alter table public.flashcards
  add column if not exists verb_keys text[];
