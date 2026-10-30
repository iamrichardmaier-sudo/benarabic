#!/usr/bin/env python3
"""
Turn a saved Supabase query result into WORK/existing_words.json.

    python3 -I scripts/quran/import_bank_export.py SAVED_RESULT.txt WORK/existing_words.json

Run this query first and save its (large) result:

    select jsonb_agg(jsonb_build_object('key', key, 'word', word, 'word_voweled', word_voweled,
           'english', english, 'root', root, 'word_type', word_type, 'verb_form', verb_form)
           order by key) as rows from public.words;
"""
import json
import re
import sys

raw = json.load(open(sys.argv[1], encoding='utf-8'))
txt = raw['result'] if isinstance(raw, dict) else raw
m = re.search(r'<untrusted-data-[0-9a-f-]+>\n(.*?)\n</untrusted-data-', txt, re.S)
rows = json.loads(m.group(1))[0]['rows']
json.dump(rows, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
print(len(rows), 'words')
