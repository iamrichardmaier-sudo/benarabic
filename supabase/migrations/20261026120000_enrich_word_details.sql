-- Fuller detail on every saved word: a Fusha example sentence, a Shaami one
-- built on the word's Levantine equivalent, and the family of common words
-- that share its root. Filled in by the enrich-words edge function.
--
-- Both tables get the same columns: `flashcards` holds each learner's own
-- saved words, `words` the shared deck vocabulary.

alter table public.flashcards
  add column if not exists fusha_sentence text,
  add column if not exists fusha_sentence_en text,
  add column if not exists shaami_sentence text,
  add column if not exists shaami_sentence_en text,
  -- [{ "word": voweled Arabic, "english": meaning, "type": e.g. "Form II verb" }]
  add column if not exists root_family jsonb,
  add column if not exists enriched_at timestamptz,
  -- Why the last attempt failed; a row with an error is skipped until cleared.
  add column if not exists enrich_error text;

alter table public.words
  add column if not exists fusha_sentence text,
  add column if not exists fusha_sentence_en text,
  add column if not exists shaami_sentence text,
  add column if not exists shaami_sentence_en text,
  add column if not exists root_family jsonb,
  add column if not exists enriched_at timestamptz,
  add column if not exists enrich_error text;

create index if not exists flashcards_enrich_pending_idx
  on public.flashcards (created_at) where enriched_at is null and enrich_error is null;
create index if not exists words_enrich_pending_idx
  on public.words (created_at) where enriched_at is null and enrich_error is null;

-- The words still waiting, each spelling once, with the details already held
-- for it (from whichever row has the most), oldest first.
create or replace function public.pending_word_enrichment(p_limit int default 8)
returns table (
  word text,
  english text,
  shaami text,
  root text,
  word_type text,
  verb_form text,
  gender text
)
language sql
stable
security definer
set search_path = public
as $$
  with pending as (
    select f.word, f.english, f.shaami, f.root, f.word_type, f.verb_form, f.gender, f.created_at
    from public.flashcards f
    where f.enriched_at is null and f.enrich_error is null
    union all
    select w.word, w.english, w.shaami, w.root, w.word_type, w.verb_form, w.gender, w.created_at
    from public.words w
    where w.enriched_at is null and w.enrich_error is null
  ),
  ranked as (
    select p.*,
      row_number() over (
        partition by p.word
        order by (p.english is not null)::int + (p.shaami is not null)::int
               + (p.root is not null)::int + (p.word_type is not null)::int desc,
                 p.created_at
      ) as rn,
      min(p.created_at) over (partition by p.word) as first_seen
    from pending p
    where btrim(p.word) <> ''
  )
  select r.word, r.english, r.shaami, r.root, r.word_type, r.verb_form, r.gender
  from ranked r
  where r.rn = 1
  order by r.first_seen
  limit greatest(p_limit, 1);
$$;

-- How many distinct spellings are still waiting.
create or replace function public.pending_word_enrichment_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct word) from (
    select word from public.flashcards where enriched_at is null and enrich_error is null
    union all
    select word from public.words where enriched_at is null and enrich_error is null
  ) p
  where btrim(word) <> '';
$$;

-- Writes one word's enrichment to every row holding that spelling, in both
-- tables. Fill-only: a value already there — typed by the learner or set by
-- an earlier tagging pass — is never replaced. Returns the rows touched.
create or replace function public.apply_word_enrichment(p_word text, p jsonb)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  touched int := 0;
  n int;
  v_gender text := case when p->>'gender' in ('m', 'f') then p->>'gender' end;
  v_family jsonb := case when jsonb_typeof(p->'root_family') = 'array'
                          and jsonb_array_length(p->'root_family') > 0
                         then p->'root_family' end;
  v_companions jsonb := case when jsonb_typeof(p->'companion_forms') = 'array'
                              and jsonb_array_length(p->'companion_forms') > 0
                             then p->'companion_forms' end;
begin
  update public.flashcards set
    english            = coalesce(english, nullif(p->>'english', '')),
    word_voweled       = coalesce(word_voweled, nullif(p->>'word_voweled', '')),
    root               = coalesce(root, nullif(p->>'root', '')),
    word_type          = coalesce(word_type, nullif(p->>'word_type', '')),
    verb_form          = coalesce(verb_form, nullif(p->>'verb_form', '')),
    past_tense         = coalesce(past_tense, nullif(p->>'past_tense', '')),
    present_tense      = coalesce(present_tense, nullif(p->>'present_tense', '')),
    masdar_form        = coalesce(masdar_form, nullif(p->>'masdar_form', '')),
    gender             = coalesce(gender, v_gender),
    fusha_plural       = coalesce(fusha_plural, nullif(p->>'fusha_plural', '')),
    shaami             = coalesce(shaami, nullif(p->>'shaami', '')),
    shaami_plural      = coalesce(shaami_plural, nullif(p->>'shaami_plural', '')),
    fusha_sentence     = coalesce(fusha_sentence, nullif(p->>'fusha_sentence', '')),
    fusha_sentence_en  = coalesce(fusha_sentence_en, nullif(p->>'fusha_sentence_en', '')),
    shaami_sentence    = coalesce(shaami_sentence, nullif(p->>'shaami_sentence', '')),
    shaami_sentence_en = coalesce(shaami_sentence_en, nullif(p->>'shaami_sentence_en', '')),
    root_family        = coalesce(root_family, v_family),
    companion_forms    = case when companion_forms is null or jsonb_array_length(companion_forms) = 0
                              then coalesce(v_companions, companion_forms) else companion_forms end,
    enriched_at        = now(),
    enrich_error       = null
  where word = p_word and enriched_at is null;
  get diagnostics n = row_count;
  touched := touched + n;

  update public.words set
    english             = coalesce(english, nullif(p->>'english', '')),
    word_voweled        = coalesce(word_voweled, nullif(p->>'word_voweled', '')),
    root                = coalesce(root, nullif(p->>'root', '')),
    word_type           = coalesce(word_type, nullif(p->>'word_type', '')),
    verb_form           = coalesce(verb_form, nullif(p->>'verb_form', '')),
    past_tense          = coalesce(past_tense, nullif(p->>'past_tense', '')),
    present_tense       = coalesce(present_tense, nullif(p->>'present_tense', '')),
    masdar_form         = coalesce(masdar_form, nullif(p->>'masdar_form', '')),
    gender              = coalesce(gender, v_gender),
    fusha_plural        = coalesce(fusha_plural, nullif(p->>'fusha_plural', '')),
    shaami              = coalesce(shaami, nullif(p->>'shaami', '')),
    shaami_plural       = coalesce(shaami_plural, nullif(p->>'shaami_plural', '')),
    -- The deck preview already shows example_sentence; give it the Fusha one.
    example_sentence    = coalesce(example_sentence, nullif(p->>'fusha_sentence', '')),
    example_sentence_en = coalesce(example_sentence_en, nullif(p->>'fusha_sentence_en', '')),
    fusha_sentence      = coalesce(fusha_sentence, nullif(p->>'fusha_sentence', '')),
    fusha_sentence_en   = coalesce(fusha_sentence_en, nullif(p->>'fusha_sentence_en', '')),
    shaami_sentence     = coalesce(shaami_sentence, nullif(p->>'shaami_sentence', '')),
    shaami_sentence_en  = coalesce(shaami_sentence_en, nullif(p->>'shaami_sentence_en', '')),
    root_family         = coalesce(root_family, v_family),
    companion_forms     = case when companion_forms is null or jsonb_array_length(companion_forms) = 0
                               then coalesce(v_companions, companion_forms) else companion_forms end,
    enriched_at         = now(),
    enrich_error        = null
  where word = p_word and enriched_at is null;
  get diagnostics n = row_count;
  touched := touched + n;

  return touched;
end;
$$;

-- Parks a word the model could not handle, so the run moves past it.
create or replace function public.mark_word_enrichment_failed(p_word text, p_error text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.flashcards set enrich_error = left(p_error, 500)
    where word = p_word and enriched_at is null;
  update public.words set enrich_error = left(p_error, 500)
    where word = p_word and enriched_at is null;
$$;

-- These run across every learner's rows, so only the edge function's
-- service role may call them — never a signed-in user or the public key.
revoke all on function public.pending_word_enrichment(int) from public, anon, authenticated;
revoke all on function public.pending_word_enrichment_count() from public, anon, authenticated;
revoke all on function public.apply_word_enrichment(text, jsonb) from public, anon, authenticated;
revoke all on function public.mark_word_enrichment_failed(text, text) from public, anon, authenticated;
grant execute on function public.pending_word_enrichment(int) to service_role;
grant execute on function public.pending_word_enrichment_count() to service_role;
grant execute on function public.apply_word_enrichment(text, jsonb) to service_role;
grant execute on function public.mark_word_enrichment_failed(text, text) to service_role;
