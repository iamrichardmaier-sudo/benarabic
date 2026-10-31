-- Each daily translation sentence carries its answer key: the sentence split
-- into chunks, each with its accepted wordings and the mistakes a learner is
-- likely to make (see supabase/answer-keys/README.md). The app grades against
-- it directly, so no model is called when a learner checks a translation.

alter table public.translation_challenges
  add column if not exists answer_key jsonb;
