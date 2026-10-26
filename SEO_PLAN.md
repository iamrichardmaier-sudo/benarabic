# Wazn SEO Plan — getting to the top when people look up Arabic words

Written 2026-10-26 after an audit of the repo and the live site (waznarabic.com).
Follows on from `SEO_BUILD_LOG.md`, which covers the first batch of pages.

## Status

- **Phase 1 (basics): done.** Logged-out home page with real content, real 404s,
  `/auth` kept out of search, IndexNow on every deploy, pages generated in the
  build, sitemap index, breadcrumbs, validation, service-worker fix.
  Waiting on: Search Console verification (see section 4).
- **Phase 2 (word pages): first batch shipped.** Built on Wiktionary data rather
  than the Bible glosses (see `scripts/seo/README.md`). SpanishDict-style pages:
  numbered senses with examples, highlights, root family grouped by verb form
  with each verb's nouns under it, conjugation tables, plurals and alternative
  plurals, pronunciation button. Batch size in `scripts/seo/config.json`.

---

## 1. Where things stand

**What works**
- waznarabic.com is live on Netlify. `www` and the old GitHub Pages URL both 301 to it.
- 39 static, crawlable pages: 25 root pages, 10 verb-form pages, 3 hubs, plus a sitemap and robots.txt.
- The pages are fast, plain HTML, with canonicals and structured data.

**What's holding it back**

| # | Problem | Effect |
|---|---|---|
| 1 | **Google has indexed 0 pages.** A `site:waznarabic.com` search returns nothing. Search Console was never verified and the sitemap was never submitted. | Nothing can rank until this is fixed. It's the biggest issue. |
| 2 | **The homepage is blank to Google.** `/` serves an empty `<div id="root">`, then JavaScript sends logged-out visitors to a login form. | The page with the most authority says nothing about Arabic, and links to none of the reference pages. |
| 3 | **Every unknown URL returns 200** (e.g. `/root/zzz-not-real/`, `/word/kitab`), each showing the app shell. | Google sees these as "soft 404s", which wastes crawl budget and lowers trust in the site. |
| 4 | **`/auth` is indexable.** | A login page competes with the real pages. |
| 5 | **Only 39 pages, and no page per word.** People search for words (*kitab meaning*, *maktaba*, *istaqbala conjugation*), but a word only appears as a row inside a root page. | We can't rank for the searches people actually make. |
| 6 | **No transliteration on word rows.** Most English speakers search `kitab`, not `كتاب`. | We miss the main search form. |
| 7 | **Word glosses come from Bible context** ("call! (m.)", "that he be registered", "the cohort/battalion"). | Fine for illustrating a verse, but poor as a dictionary headword. |
| 8 | **913 of the 1,229 roots have no meaning text**, so the quality bar holds them back. | 97% of root pages are still unpublished. |
| 9 | **The generator isn't part of the build.** Pages are committed by hand. | The sitemap's `lastmod` and the pages go stale. |

---

## 2. A realistic goal

Head terms like *"kitab meaning"* belong to Wiktionary, Almaany, and Google's own translate box, all of which have 15+ years of authority. A new domain won't beat them in the first months, and no code change can make it.

What a new domain **can** win is the **long tail**: tens of thousands of specific searches where the current results are forum posts, thin pages, or nothing. For example:
- `istaqbala conjugation` (current top results: a FSI chart for a different verb, and arabic.fi)
- `what is the root of maktaba`
- `arabic words from the root q-b-l`
- `form X verbs list with examples`
- `maktab vs maktaba`

Ten thousand searches a month at rank 1–3 bring more learners than one head term at rank 8. The plan is built around that.

---

## 3. The plan

Everything below is code I can write. Your part is in section 4 (about 15 minutes in total).

### Phase 1 — Fix the foundations (1 session, do first)

None of this adds content. It makes sure Google can see, trust, and keep up with what's already there.

1. **Search Console verification.** I add the verification tag/file to the site. You click "Verify" and submit the sitemap (section 4).
2. **IndexNow.** Add a key file and a small build step that pings Bing, Yandex, and others whenever pages change. No account needed; Bing also powers DuckDuckGo and ChatGPT search.
3. **Static homepage content.** Put a real landing page inside `index.html` (heading, what Wazn is, links to Roots, Verb forms, and the guide). React replaces it when the app loads. Logged-in users never see it, because a tiny inline script checks for a session first. Google sees a full page that links into the reference pages.
4. **Real 404s.** Netlify rules so unknown `/root/*`, `/form/*`, `/word/*`, and `/verb/*` paths return a proper 404 page instead of the app.
5. **`noindex` on `/auth`** via a Netlify header.
6. **Run the generator during the Netlify build**, so the sitemap and pages are always current. Turn the sitemap into a sitemap index split by page type (roots, words, verbs, forms) so Search Console reports indexing per type.
7. **On-page improvements to existing pages:**
   - Transliteration next to every Arabic word (`كِتَاب kitāb`), plus a plain-ASCII form for search (`kitab`).
   - `BreadcrumbList` structured data (gives breadcrumb paths in search results).
   - Titles rewritten around the searched phrase, e.g. `Arabic root k-t-b (ك ت ب): meaning & all words from it`.
   - One generated social preview image per page type.
   - Previous/next and "related roots" links on every root page, so there are no dead ends for crawlers.
8. **Tests** for the generator: every page has one H1, a canonical, a unique title, valid JSON-LD, and no broken internal links. This runs in CI so a bad batch can't ship.

### Phase 2 — A page for every word (1–2 sessions)

This is where the site starts matching what people type.

1. **Word pages** at `/word/kitab/` for the 3,140 words in the corpus. Each has:
   - The vocalized word, transliteration, part of speech, and verb form
   - A clean dictionary meaning (see point 3)
   - Its root, linked, and the rest of the word family
   - Its pattern (*wazn*): "كِتَاب follows فِعَال, like جِبَال and كِلَاب" — something no competitor shows, and the brand's whole idea
   - A real example sentence with English
   - The plural, masdar, and present tense where they're known
   - A "practise this word" button into the app
   Slugs are saved permanently in a JSON map (like `root-slugs.json`), so URLs never change. Words that collide get a suffix (`/word/alim-2/`).
2. **All 1,229 corpus roots get meanings.** Wiktionary covers many of them; for the rest I write a short meaning and check it against Wiktionary and Lane's Lexicon. The quality bar stays: a root needs at least 3 words and a meaning before it's published.
3. **Clean headword meanings.** Replace verse-context glosses ("that he be registered") with dictionary meanings ("to register, enrol"). The verse gloss stays as the example's translation, where it belongs.
4. **Release in batches** of about 500 pages. Watch the Search Console "Indexed" count between batches. If Google starts holding pages back ("Crawled – currently not indexed"), pause and make pages richer before publishing more.

Result: roughly **35 → ~4,400 pages**.

### Phase 3 — Wiktionary data: conjugations and a much larger word list (2–3 sessions)

Wiktionary's Arabic data is published as a free download (kaikki.org, updated weekly, CC BY-SA, the same licence as STEPBible that we already credit). I streamed the full file during this audit:

| What it has | Count |
|---|---|
| Arabic dictionary headwords linked to a root | **~10,200** |
| Distinct roots | **~2,800** (vs 1,229 today) |
| Verbs with a full conjugation table | **~7,400** |
| Entries with transliteration | almost all |

1. **Verb conjugation pages** at `/verb/istaqbala/`. Full past, present, subjunctive, jussive, imperative, participles, and masdar for every person, with transliteration. *"[verb] conjugation"* is one of the most common Arabic learner searches, and the current results are weak (see section 2). Each page links to its root, its form page, and its example sentences, and has a "drill this conjugation" button into the existing Forms tab.
2. **Grow word and root pages** to the full ~10,000 words and ~2,800 roots. Corpus examples are added when we have them.
3. **Avoid being a plain copy of Wiktionary.** Google ignores duplicates of pages it already has. Each page combines things Wiktionary keeps on separate pages: root family + pattern + conjugation + real example + practice. A page is published only when it has at least two of these besides the definition.
4. **Keep the data small.** A one-off script reduces the 868 MB download to a compact file of just the fields we use (estimated 10–20 MB compressed), committed to `scripts/seo/data/`. The Netlify build then needs no network and no database login. A monthly refresh is one command.
5. **Attribution**: "Definitions from Wiktionary, CC BY-SA 4.0" in each page footer, next to the STEPBible credit already there.

Result: roughly **~4,400 → ~20,000 pages**.

### Phase 4 — Guides that rank for broad searches (1 session)

A handful of evergreen articles that answer common learner questions, built from our own data so they're better than blog posts:
- *How to find the root of an Arabic word* (with a live box: type a word, get its root, using the existing skeleton index)
- *Arabic verb forms I–X chart* (one printable table, every cell linked)
- *Broken plural patterns* (with real examples from our data, every one linked)
- *Masdar patterns*, *active and passive participles*, *weak verbs (hollow, defective, assimilated)*

These pages earn links from teachers and forums, and that authority flows into the word pages they link to.

### Phase 5 — Optional: reading pages (1 session, needs your OK)

Each Bible and Book of Mormon chapter as a public page: Arabic with English side by side, every word linked to its word page. That's about 1,430 pages, and searches like *"John 3 in Arabic"* have almost no competition. The text is public domain.
This one is your call because of the neutral-academic framing in the build log. It can be left out without affecting anything else.

### Phase 6 — Measure and adjust (ongoing)

- Once a month, I compare the Search Console "Pages" and "Performance" reports with the plan: what's indexed, what's being held back, which searches show us at positions 5–20.
- Pages sitting at positions 5–20 get improved first (better title, more examples), since those are the cheapest wins.
- If you'd rather not paste screenshots, Search Console can export to a Google Sheet that I read.

---

## 4. What I need from you

| When | What | Time |
|---|---|---|
| After Phase 1 is deployed | Open [Search Console](https://search.google.com/search-console), add `waznarabic.com` as a URL-prefix property, choose "HTML tag", and click **Verify** (I'll have added the tag already). Then go to Sitemaps and submit `sitemap.xml`. | ~10 min, once |
| Same time (optional) | In [Bing Webmaster Tools](https://www.bing.com/webmasters), choose "Import from Google Search Console". | ~2 min, once |
| Before Phase 5 | Yes or no on public Bible/Book of Mormon reading pages. | One reply |
| Monthly (optional) | Share the Search Console Performance numbers. | ~2 min |

Optional, but it helps more than any code: when Phase 2 ships, post the site once where Arabic learners gather (an Arabic class group chat, r/learn_arabic). A handful of real links tells Google the site is worth crawling.

---

## 5. Timeline and what to expect

| | Pages | Expected |
|---|---|---|
| Phase 1 + verification | 39 | Google starts crawling within days; the first pages are indexed in 1–3 weeks |
| Phase 2 | ~4,400 | Long-tail impressions start in 3–6 weeks |
| Phase 3 | ~20,000 | Conjugation and root searches are where clicks should grow; most new sites need 3–6 months to rank steadily |
| Phase 4 | +6 guides | Earn links; lift everything else |

## 6. Risks and how the plan handles them

- **Google's "scaled content" policy** targets large numbers of thin, auto-generated pages. Handled by: the quality bar, combining sources into something no single site has, releasing in batches, and watching the indexing rate before each new batch.
- **Wrong data on public pages.** Handled by: build-time checks (vowel marks, transliteration consistency, a root's letters appearing in each of its words), and a manual spot-check of 50 random pages per batch.
- **Repo and build size.** Pages are generated during the build, not committed. Only the compact data file is committed.
- **No changes to the app itself**, apart from the static landing markup in `index.html`. The study tool, login, and data stay as they are.
