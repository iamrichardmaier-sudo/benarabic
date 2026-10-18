-- Forms tab: reference data for the ten verb forms, a pre-generated paradigm
-- per (root, form), and the learner's quiz history.
--
-- Everything here is generated offline and stored. Weak verbs in particular
-- are never guessed from rules at runtime: what the app shows is a row a
-- generator wrote and, below "high" confidence, an admin reviewed.

create table if not exists public.verb_forms (
  form text primary key check (form in ('I','II','III','IV','V','VI','VII','VIII','IX','X')),
  sort smallint not null,
  pattern_past text not null,
  pattern_present text not null,
  masdar_pattern text not null,
  summary_en text not null,
  detail_en text not null
);

create table if not exists public.verb_conjugations (
  id uuid primary key default gen_random_uuid(),
  root text not null,
  form text not null references public.verb_forms(form),
  past text not null,
  present text not null,
  masdar text,
  meaning_en text,
  -- 0 = not attested, 1 rare, 2 occasional, 3 common, 4 very common.
  usage_tier smallint not null default 0 check (usage_tier between 0 and 4),
  confidence text not null default 'low' check (confidence in ('high','medium','low')),
  weak_type text not null default 'sound'
    check (weak_type in ('sound','hollow','defective','assimilated','doubled','hamzated','mixed')),
  source text not null default 'generated',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (root, form)
);
create index if not exists verb_conjugations_root_idx on public.verb_conjugations (root);
create index if not exists verb_conjugations_review_idx on public.verb_conjugations (confidence)
  where confidence <> 'high' and usage_tier > 0;

create table if not exists public.form_quiz_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  mode text not null check (mode in ('identify','meanings','heatmap')),
  level smallint,
  score smallint not null,
  total smallint not null,
  missed jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index if not exists form_quiz_results_user_idx on public.form_quiz_results (user_id, created_at desc);

alter table public.verb_forms enable row level security;
alter table public.verb_conjugations enable row level security;
alter table public.form_quiz_results enable row level security;

create policy "Verb forms are readable by signed-in users" on public.verb_forms
  for select to authenticated using (true);
create policy "Only the admin writes verb forms" on public.verb_forms
  for all to authenticated using (public.is_deck_admin()) with check (public.is_deck_admin());

create policy "Conjugations are readable by signed-in users" on public.verb_conjugations
  for select to authenticated using (true);
create policy "Only the admin writes conjugations" on public.verb_conjugations
  for all to authenticated using (public.is_deck_admin()) with check (public.is_deck_admin());

create policy "Quiz results are yours" on public.form_quiz_results
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.verb_forms (form, sort, pattern_past, pattern_present, masdar_pattern, summary_en, detail_en) values
('I', 1, 'فَعَلَ', 'يَفْعَلُ', 'فَعْل', 'The plain action', 'The base form. It carries the root idea with nothing added.'),
('II', 2, 'فَعَّلَ', 'يُفَعِّلُ', 'تَفْعيل', 'Causative or intensive', 'Doubling the middle letter either makes someone else do the action, or makes it thorough and repeated.'),
('III', 3, 'فاعَلَ', 'يُفاعِلُ', 'مُفاعَلة', 'Done to or with someone', 'Stretching the first vowel points the action at another party.'),
('IV', 4, 'أَفْعَلَ', 'يُفْعِلُ', 'إِفْعال', 'Causative', 'A prefixed hamza makes something or someone undergo the root action.'),
('V', 5, 'تَفَعَّلَ', 'يَتَفَعَّلُ', 'تَفَعُّل', 'Form II turned back on itself', 'The subject undergoes or takes on the action themselves.'),
('VI', 6, 'تَفاعَلَ', 'يَتَفاعَلُ', 'تَفاعُل', 'Mutual, between parties', 'Two or more parties do it to each other.'),
('VII', 7, 'اِنْفَعَلَ', 'يَنْفَعِلُ', 'اِنْفِعال', 'It simply happens', 'The subject undergoes the action with nobody in view doing it.'),
('VIII', 8, 'اِفْتَعَلَ', 'يَفْتَعِلُ', 'اِفْتِعال', 'Done for oneself', 'An infixed تـ turns the action inward; meanings drift idiomatic.'),
('IX', 9, 'اِفْعَلَّ', 'يَفْعَلُّ', 'اِفْعِلال', 'Colours and defects', 'Reserved for turning a colour or taking on a physical defect.'),
('X', 10, 'اِسْتَفْعَلَ', 'يَسْتَفْعِلُ', 'اِسْتِفْعال', 'Seeking or deeming', 'اِسْتَـ means asking for the root action, seeking it out, or judging something to have that quality.')
on conflict (form) do nothing;
