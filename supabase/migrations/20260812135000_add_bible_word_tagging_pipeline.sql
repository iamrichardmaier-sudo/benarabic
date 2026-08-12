-- Background pipeline that fills in public.bible_word_tags a batch at a
-- time. Runs entirely server-side (Postgres -> the tag-bible-word edge
-- function -> Anthropic), driven by pg_cron rather than an external loop,
-- since tagging the Gospels alone means processing thousands of unique
-- words -- too many round trips to drive from application code.
CREATE EXTENSION IF NOT EXISTS http;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- One-time (idempotent) seed: pulls the Gospel word list from the repo and
-- inserts each as a pending row. Safe to call again -- ON CONFLICT DO NOTHING
-- means it only ever adds words that aren't already queued or tagged.
CREATE OR REPLACE FUNCTION public.seed_bible_word_queue(source_url text)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  resp public.http_response;
  words jsonb;
  inserted int;
BEGIN
  resp := public.http_get(source_url);
  IF resp.status <> 200 THEN
    RAISE EXCEPTION 'seed_bible_word_queue: fetch failed with status %', resp.status;
  END IF;

  words := resp.content::jsonb;

  INSERT INTO public.bible_word_tags (surface)
  SELECT value FROM jsonb_array_elements_text(words)
  ON CONFLICT (surface) DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

-- Processes one batch of pending words: sends them to the tag-bible-word
-- edge function and writes back whatever it returns. An advisory lock keeps
-- overlapping cron ticks from racing each other if one run takes longer
-- than the schedule interval. Anything the model silently drops still gets
-- marked tagged (pos = 'unresolved') so it doesn't loop forever.
CREATE OR REPLACE FUNCTION public.process_bible_tag_batch(batch_size int DEFAULT 40)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  words text[];
  resp public.http_response;
  parsed jsonb;
  item jsonb;
  tagged_count int := 0;
BEGIN
  IF NOT pg_try_advisory_lock(778899) THEN
    RETURN -1;
  END IF;

  -- The http extension's default 5s timeout is too short for an LLM call;
  -- this is a per-connection curl setting, so pg_cron's own session needs
  -- it set here too, not just an interactive one.
  PERFORM public.http_set_curlopt('CURLOPT_TIMEOUT_MS', '90000');

  SELECT array_agg(surface) INTO words
  FROM (
    SELECT surface FROM public.bible_word_tags
    WHERE tagged_at IS NULL
    ORDER BY surface
    LIMIT batch_size
  ) s;

  IF words IS NULL OR array_length(words, 1) IS NULL THEN
    PERFORM pg_advisory_unlock(778899);
    RETURN 0;
  END IF;

  -- The anon key is public by design -- it already ships in the client
  -- bundle -- so embedding it here carries no extra exposure.
  resp := public.http((
    'POST',
    'https://fphpcfecgnfoogfaeihu.supabase.co/functions/v1/tag-bible-word',
    ARRAY[
      public.http_header('apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaHBjZmVjZ25mb29nZmFlaWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzY2NjAsImV4cCI6MjA5OTk1MjY2MH0.2OXlbp8EuQpgv0Mnk5Ps3XbL16-vI8vDDRTWi4yYOk4'),
      public.http_header('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwaHBjZmVjZ25mb29nZmFlaWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNzY2NjAsImV4cCI6MjA5OTk1MjY2MH0.2OXlbp8EuQpgv0Mnk5Ps3XbL16-vI8vDDRTWi4yYOk4'),
      public.http_header('Content-Type', 'application/json')
    ],
    'application/json',
    jsonb_build_object('words', to_jsonb(words))::text
  )::public.http_request);

  IF resp.status <> 200 THEN
    PERFORM pg_advisory_unlock(778899);
    RAISE WARNING 'process_bible_tag_batch: http status %: %', resp.status, left(resp.content, 500);
    RETURN -2;
  END IF;

  parsed := resp.content::jsonb;

  FOR item IN SELECT * FROM jsonb_array_elements(parsed->'results')
  LOOP
    UPDATE public.bible_word_tags
    SET
      root = NULLIF(item->>'root', ''),
      lemma = item->>'lemma',
      pos = item->>'pos',
      verb_form = NULLIF(item->>'verbForm', ''),
      gloss = item->>'gloss',
      tagged_at = now()
    WHERE surface = item->>'surface';
    tagged_count := tagged_count + 1;
  END LOOP;

  -- Words the model didn't return still leave the queue, or they'd be
  -- retried every tick forever and starve real progress.
  UPDATE public.bible_word_tags
  SET tagged_at = now(), pos = 'unresolved'
  WHERE surface = ANY(words) AND tagged_at IS NULL;

  PERFORM pg_advisory_unlock(778899);
  RETURN tagged_count;
END;
$$;

-- Every 30s, one batch of 40 words. At full queue depth (~11.5k Gospel
-- words) that's roughly 2-3 hours to finish, safely paced under any
-- reasonable API rate limit.
SELECT cron.schedule('bible-word-tagging', '30 seconds', $$SELECT public.process_bible_tag_batch(40);$$);
