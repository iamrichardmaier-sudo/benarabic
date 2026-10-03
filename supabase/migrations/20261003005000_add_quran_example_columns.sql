-- A verified Qur'an excerpt that uses this word (or another form of the
-- same root), authored once per words row -- shared, reusable dictionary
-- fact -- then copied down onto each flashcards row the same way root/
-- word_type/etc. already are, so both new and already-existing cards show
-- it on the actual studied card, not just the browse-before-adding screen.

alter table public.words
  add column if not exists quran_example text,
  add column if not exists quran_example_en text,
  add column if not exists quran_reference text;

alter table public.flashcards
  add column if not exists quran_example text,
  add column if not exists quran_example_en text,
  add column if not exists quran_reference text;
