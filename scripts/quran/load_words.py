#!/usr/bin/env python3
"""
Print the SQL that loads the merged chunks into public.words.

    python3 scripts/quran/load_words.py COMMIT_SHA BATCH N_CHUNKS [--rollback]

The database fetches each chunk (scripts/quran/seed/words-NNN.json) from the public repo at an
immutable commit, the same way seed_bible_word_queue() fetched the Gospel word list, so the rows
never have to be pasted through a client. One statement per chunk, each idempotent: a row whose
key already exists is skipped, so a chunk can be re-run safely and nothing in the bank is ever
overwritten. Nothing here touches deck_words or flashcards: loaded words are in the bank, in no deck.

Rows are recognisable afterwards by created_by IS NULL (every earlier row has an owner), which is
what the rollback in the README uses.
"""

import sys

COLS = ('key', 'word', 'word_voweled', 'english', 'root', 'word_type', 'verb_form', 'past_tense',
        'present_tense', 'masdar_form', 'gender', 'fusha_plural', 'companion_forms', 'quran_example',
        'quran_example_en', 'quran_reference')
TYPES = {c: 'text' for c in COLS}
TYPES['companion_forms'] = 'jsonb'
REPO = 'https://raw.githubusercontent.com/iamrichardmaier-sudo/benarabic'


def chunk_sql(sha, batch, i):
    url = f'{REPO}/{sha}/scripts/quran/seed/{batch}/words-{i:03d}.json'
    rec = ', '.join(f'{c} {TYPES[c]}' for c in COLS)
    cols = ', '.join(COLS)
    sel = ', '.join(f'r.{c}' for c in COLS)
    return f"""with src as (
  select (public.http_get('{url}')).content::jsonb as j
), ins as (
  insert into public.words ({cols})
  select {sel}
  from src, jsonb_to_recordset(src.j) as r({rec})
  where not exists (select 1 from public.words w where w.key = r.key)
  returning 1
)
select {i} as chunk, (select jsonb_array_length(j) from src) as fetched, (select count(*) from ins) as inserted;"""


def rollback_sql(sha, batch, i):
    """Delete exactly the rows of one chunk, and only if nobody has put them in a deck or studied them."""
    url = f'{REPO}/{sha}/scripts/quran/seed/{batch}/words-{i:03d}.json'
    return f"""with src as (
  select (public.http_get('{url}')).content::jsonb as j
), del as (
  delete from public.words w
  using src, jsonb_to_recordset(src.j) as r(key text, word text)
  where w.key = r.key and w.word = r.word and w.created_by is null
    and not exists (select 1 from public.deck_words d where d.word_id = w.id)
    and not exists (select 1 from public.flashcards f where f.word_id = w.id)
  returning 1
)
select {i} as chunk, (select count(*) from del) as deleted;"""


if __name__ == '__main__':
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    sha, batch, n = sys.argv[1], sys.argv[2], int(sys.argv[3])
    fn = rollback_sql if '--rollback' in sys.argv else chunk_sql
    for i in range(n):
        print(fn(sha, batch, i))
        print()
