# Reference pages (dictionary, roots, verb forms)

Static HTML pages that search engines can read, generated on every build:

```sh
npm run seo     # just the pages, into public/
npm run build   # pages, then the app
```

The pages land in `public/word/`, `public/root/`, … and are **not committed**
(see `.gitignore`); Netlify generates them on each deploy.

| Path | What |
|---|---|
| `/word/<slug>/` | One page per word: meaning(s) with examples, highlights, root family by verb form, conjugation or plurals, example sentences |
| `/root/<slug>/` | Every word from one root, each verb with its verbal noun and participles |
| `/form/1/` … `/form/10/` | The ten verb forms with their most common verbs |
| `/words/` | Dictionary home with search, A–Z pages and `/words/most-common/` |
| `/sitemap.xml` | Sitemap index pointing at one sitemap per page type |

## How many word pages

`config.json` → `wordPages`. Words are published most-common first, so raising
the number adds the next batch. URLs are stored in `word-slugs.json` and
`root-slugs.json` and never change once assigned; commit those files after a run
that adds pages.

## Data

`data/dictionary.json.gz` is built from Wiktionary by `wiktionary/build.py`
(instructions at the top of that file). Refresh it every few months:
Wiktionary keeps improving. The checks that keep the data honest:

- A root is only used when Wiktionary states it for that exact word (its own
  etymology section), and its letters must appear in the word.
- A noun is listed under a verb only when Wiktionary says it is that verb's
  verbal noun or participle, or its etymology names that verb.
- Example sentences are real: Wiktionary's own (with their sources) and verses
  from the app's tagged corpus, used only when the word match is unambiguous.
- `lib/validate.mjs` fails the build on a broken link, a duplicate title, a
  missing heading or Latin letters inside Arabic text.

Sources and licenses are credited in each page's footer: Wiktionary (CC BY-SA
4.0), Wikimedia Commons recordings, FrequencyWords (CC BY-SA 4.0), the Smith &
Van Dyke Bible (public domain) tagged with STEPBible data (CC BY-SA 4.0).

## Search engines

- `netlify/functions/deploy-succeeded.mjs` tells IndexNow (Bing, Yandex …)
  which pages changed after each production deploy.
- Google: verify the site in Search Console and submit `/sitemap.xml` once.
