-- Transcripts for the memorization drill: a passage stored word-for-word
-- exactly as given, blanked out at practice time rather than pre-split into
-- vocabulary the way flashcards are. Unrelated to flashcards.card_group,
-- which happens to use the same "Chapter N" naming by coincidence of the
-- source material, not by any code linkage.

CREATE TABLE IF NOT EXISTS public.transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL,
  subtitle text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transcripts_user_id_idx ON public.transcripts (user_id);

ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transcripts" ON public.transcripts;
CREATE POLICY "Users can view their own transcripts"
  ON public.transcripts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own transcripts" ON public.transcripts;
CREATE POLICY "Users can insert their own transcripts"
  ON public.transcripts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own transcripts" ON public.transcripts;
CREATE POLICY "Users can update their own transcripts"
  ON public.transcripts FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own transcripts" ON public.transcripts;
CREATE POLICY "Users can delete their own transcripts"
  ON public.transcripts FOR DELETE
  USING (auth.uid() = user_id);
