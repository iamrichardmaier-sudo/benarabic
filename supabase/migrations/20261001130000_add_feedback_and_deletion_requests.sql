-- Two small request-queue tables for Phase 4 of the usability audit:
-- "Send feedback" and "Delete my account" both just record a request here
-- rather than auto-processing it. Neither has an app-facing select/update/
-- delete policy — they're read by the admin from the Supabase dashboard,
-- the same access model as the other admin-only tables in this schema.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  email text,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Readers submit their own feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  email text,
  requested_at timestamptz not null default now()
);

alter table public.account_deletion_requests enable row level security;

create policy "Readers request deletion of their own account"
  on public.account_deletion_requests for insert
  with check (auth.uid() = user_id);
