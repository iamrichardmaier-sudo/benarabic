# Vocab readings

One short reading per deck, written around the deck's words, shown in the
Library under **Vocab readings** and titled after the deck.

A reading is a row in `private_texts` with `kind = 'vocab_reading'` (ordinary
saved texts are `kind = 'text'`, so the two never mix). Each JSON file here is
one reading:

- `title`: the deck's title, which is also the reading's title
- `body`: the Arabic, fully voweled, one paragraph per line
- `english`: the translation, one line per line of `body`
- `word_tags`: a sense for every distinct word, keyed by consonant skeleton
  (the same shape a saved text uses), so every word is tappable. Words that are
  on the deck's cards carry the card's own sense.
- `audio_url`: the narration, made by the app's own `generate-speech` function
  (the same Arabic voice as the rest of the app) and kept in the public
  `word-audio` bucket. It plays with no word-by-word highlighting, because the
  recording has no timings; add `audio_words` to the row to get highlighting.

Load one with `select ... from http_get('<raw github url of the file>')` as in
the nightly answer-key loads, inserting `kind = 'vocab_reading'`, `work =
'library'`, `book_code = <new uuid>`, `chapter = 1`, `verses = '[]'`.
