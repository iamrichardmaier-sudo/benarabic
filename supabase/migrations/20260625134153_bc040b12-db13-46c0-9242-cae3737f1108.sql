ALTER TABLE public.flashcards
  ADD COLUMN root text,
  ADD COLUMN word_type text,
  ADD COLUMN verb_form text,
  ADD COLUMN paired_word_id uuid REFERENCES public.flashcards(id) ON DELETE SET NULL,
  ADD COLUMN needs_review boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS flashcards_root_idx ON public.flashcards(root);
CREATE INDEX IF NOT EXISTS flashcards_verb_form_idx ON public.flashcards(verb_form);
CREATE INDEX IF NOT EXISTS flashcards_paired_word_id_idx ON public.flashcards(paired_word_id);