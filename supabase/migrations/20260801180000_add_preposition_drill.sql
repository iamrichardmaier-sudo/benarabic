-- Some words (mostly verbs, plus a handful of adjectives/participles) always
-- take a specific preposition — نَجَحَ في, تَعَرَّفَ على, مَشغول بِـ — and getting the
-- preposition wrong is a distinct, common mistake from getting the word wrong.
-- These columns let a card carry that preposition plus a ready-made
-- fill-in-the-blank sentence for drilling it, independent of the word's other
-- tagging (root, verb form, etc.).
--
-- Columns live on flashcards rather than a side table: at most one fixed
-- preposition per card, and the sentence is authored specifically for that
-- card's tense/context rather than being reusable data.

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS fixed_preposition text,
  ADD COLUMN IF NOT EXISTS preposition_sentence text,
  ADD COLUMN IF NOT EXISTS preposition_sentence_en text;
