-- Word-level morphology for the Bible reader's hover feature: root, lemma,
-- part of speech, verb form, and a short gloss, per unique surface form (not
-- per occurrence -- the same word repeats constantly, e.g. "قَالَ").
--
-- Tagged progressively by a background job (see process_bible_tag_batch
-- below), not upfront, since it's ~70k unique forms for the whole Bible and
-- each batch is a real LLM call. Rows start pending (tagged_at IS NULL) and
-- a pg_cron job fills them in a batch at a time.
CREATE TABLE IF NOT EXISTS public.bible_word_tags (
  surface text PRIMARY KEY,
  root text,
  lemma text,
  pos text,
  verb_form text,
  gloss text,
  tagged_at timestamptz
);

CREATE INDEX IF NOT EXISTS bible_word_tags_root_idx ON public.bible_word_tags (root) WHERE root IS NOT NULL;
CREATE INDEX IF NOT EXISTS bible_word_tags_pending_idx ON public.bible_word_tags (surface) WHERE tagged_at IS NULL;

ALTER TABLE public.bible_word_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bible word tags are readable by any authenticated user"
  ON public.bible_word_tags FOR SELECT TO authenticated USING (true);
