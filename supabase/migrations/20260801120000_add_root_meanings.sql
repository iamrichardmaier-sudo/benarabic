-- Glosses for triliteral (and quadriliteral) roots, surfaced when hovering the
-- root in the conjugation drill.
--
-- This is reference data about the language itself, not user content: the root
-- ك-ت-ب means the same thing for everyone. It therefore lives in its own table
-- keyed by the root rather than as a column on flashcards, which would repeat
-- the same gloss across every card sharing a root and drift out of sync.
--
-- Verb-form semantics (Form II is causative, Form VII is anticausative, and so
-- on) are fixed grammar rather than data, so they stay in the frontend as a
-- constant instead of being stored here.

CREATE TABLE IF NOT EXISTS public.root_meanings (
  root text PRIMARY KEY,
  meaning text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.root_meanings ENABLE ROW LEVEL SECURITY;

-- Readable by any signed-in user; there is nothing user-specific to scope by.
-- No insert/update/delete policy: the table is maintained through migrations,
-- so the client cannot write to it.
DROP POLICY IF EXISTS "Signed-in users can read root meanings" ON public.root_meanings;
CREATE POLICY "Signed-in users can read root meanings"
  ON public.root_meanings
  FOR SELECT
  TO authenticated
  USING (true);
