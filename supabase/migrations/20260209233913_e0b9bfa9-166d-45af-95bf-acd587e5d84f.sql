
CREATE TABLE public.flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  word TEXT NOT NULL,
  english TEXT,
  image_url TEXT,
  next_review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor DOUBLE PRECISION NOT NULL DEFAULT 2.5,
  learning_stage TEXT NOT NULL DEFAULT 'new',
  stage1_attempts INTEGER NOT NULL DEFAULT 0,
  stage2_attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flashcards"
  ON public.flashcards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flashcards"
  ON public.flashcards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flashcards"
  ON public.flashcards FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own flashcards"
  ON public.flashcards FOR DELETE
  USING (auth.uid() = user_id);
