ALTER TABLE public.flashcards
  ADD COLUMN shaami text,
  ADD COLUMN word_voweled text,
  ADD COLUMN past_tense text,
  ADD COLUMN present_tense text,
  ADD COLUMN masdar_form text,
  ADD COLUMN companion_forms jsonb,
  ADD COLUMN tagged_at timestamp with time zone;
