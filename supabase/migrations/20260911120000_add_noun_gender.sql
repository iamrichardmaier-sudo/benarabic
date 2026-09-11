-- Grammatical gender, which the numbers drill cannot work without.
--
-- Arabic numerals 3–10 take the opposite gender to the noun they count, so
-- "three books" and "three magazines" differ precisely by this column:
-- ثَلاثة كُتُب against ثَلاث مَجَلّات. It is not derivable from the spelling —
-- أُمّ, أَرض, سوق and عَين are all feminine with no tāʾ marbūṭa — and a wrong
-- value here does not degrade the drill, it teaches the wrong answer.
alter table public.flashcards
  add column if not exists gender text check (gender in ('m', 'f'));

comment on column public.flashcards.gender is
  'Grammatical gender of a noun: m or f. Null where unknown or not applicable.';

-- The drill's working set: a noun needs both a gender to agree with and a
-- plural to inflect to before there is any question to ask.
create index if not exists flashcards_drillable_nouns_idx
  on public.flashcards (user_id)
  where word_type = 'noun' and gender is not null and fusha_plural is not null;
