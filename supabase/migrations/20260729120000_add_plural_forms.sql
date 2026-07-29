-- Plural forms live alongside the singular on the same card.
-- `word` remains the Fusha singular and `shaami` the Shaami singular, so
-- existing rows keep their meaning; these two columns add the plurals.
ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS fusha_plural text,
  ADD COLUMN IF NOT EXISTS shaami_plural text;
