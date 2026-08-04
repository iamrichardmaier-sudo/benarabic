-- Lets a card belong to a named batch — "Chapter 12", a unit, a week's list —
-- so study can be narrowed to that batch and widened back again.
--
-- A plain nullable column rather than a groups table: a card sits in at most
-- one batch, the name is the whole of the data, and NULL simply means the card
-- predates any grouping. "group" is reserved in SQL, hence card_group.

ALTER TABLE public.flashcards
  ADD COLUMN IF NOT EXISTS card_group text;

-- Listing the groups a user has, and filtering to one, are the only queries
-- this column serves; both are per-user.
CREATE INDEX IF NOT EXISTS flashcards_user_card_group_idx
  ON public.flashcards (user_id, card_group);
