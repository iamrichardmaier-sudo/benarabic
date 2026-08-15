# SEO Growth Layer — Build Log

Running log so this work is resumable without re-explaining context.

---

## Phase 0 — Confirmed parameters

| Question | Answer |
|---|---|
| Repo / stack | React 18 + TS + Vite + Tailwind + shadcn/ui, React Router, Supabase (PG/Auth/Edge Fns/RLS), PWA |
| Hosting | Live on **both** GitHub Pages (`/benarabic/` base path) and Netlify. Custom domain approved (~$12/yr) |
| Analytics / GSC | None currently. Both to be set up as part of this work |
| Primary user | University-level (BYU) Arabic students **and** general learners. Must serve both transliteration-dependent beginners and advanced unvocalized readers |
| Identity | **Multi-text root/morphology study tool.** Bible is one corpus; Book of Mormon, Quran, news are intended siblings. Not a religious app |
| Brand | Open — new name to be proposed (`benarabic` was a convenience domain, derived from owner's name) |
| Scope | Follow recommendation |
| Framing | Neutral/academic. Religious texts presented as *corpora*, never devotionally. Must not confuse or alienate secular or Muslim learners |
| Monetization | **Free growth layer only.** Paywall deferred |

### Carried-forward defect
Article fetcher (`fetch-article` edge function) sometimes returns only a single paragraph.
Root cause candidate: the largest-`<p>`-cluster fallback picks an immediate parent that holds
only one paragraph when the site nests each `<p>` in its own wrapper div. Needs a depth-aware
scoring pass. **Scheduled for Phase 4** — the "paste any article" flow is central to positioning.

---

## Phase 1 — Competitive & keyword research

### Landscape (verified by search, not assumed)

**Locked up — do not contest:**
- **General word lookup** (Almaany, Glosbe, Reverso, Arabdict) — enormous authority on
  "[arabic word] meaning" / "translate X to Arabic".
- **Quranic roots & morphology** — `corpus.quran.com` is comprehensive, 15+ years old, free,
  and authoritative (word-by-word morphology, root dictionary, lemma frequency lists).
  There is no realistic path to outranking it on Quranic root queries.
- **Famous roots** — Wikipedia has standalone articles for a handful (K-T-B, K-B-D, Ḥ-M-D),
  and Wiktionary has `Appendix:Arabic roots/*` entries.

**Contested / mid-authority:**
- Living Arabic Project, Aratools, arabic.fi, Rootna, Arabic Student's Dictionary (Hans Wehr),
  Lane's Lexicon digitizations, `rootwordsofquran.com`, `kuran.wiki`.

**Product competitors (weak on SEO — they're apps/extensions, not indexed content):**
- MiftahReader (closest: PDF upload → grammar + root breakdown → Anki export)
- Arabic Reader / Arabic Dictionary Chrome extensions, ArabicReader (macOS), Immersive Translate

### The structural gap

Wiktionary's root appendices are **bare derivation lists** — root → words, no vocalization
context, no attested usage, no sentences. `corpus.quran.com` does the full job, but **only for
the Quran**. No equivalent exists for any other Arabic corpus.

### Recommended wedge

> **The root-and-pattern corpus tool for the texts that don't have one.**
> Not a dictionary (lost), not Quranic morphology (lost to corpus.quran.com) — but every word
> presented *as attested in a real, fully-vocalized text, with a parallel English translation
> and a one-click drill*. The unit of value is not the definition; it is
> *root → all its forms → each form in a real sentence → practice it now.*

### Long-tail targets

**No keyword volume data was available** (no Ahrefs/SEMrush/Keyword Planner access). Rankings
below are reasoned from observed SERP weakness × learner intent × our data coverage — they are
hypotheses to validate in Search Console, not measured volumes.

| # | Target pattern | Why it's winnable | Pages |
|---|---|---|---|
| 1 | `[root] arabic root meaning` for roots with no Wikipedia/Wiktionary entry | ~900 of our 1,229 roots have no dedicated page anywhere | ~900 |
| 2 | `arabic words from the root [X]` | List intent; our data is a direct answer | ~1,229 |
| 3 | `what is the root of [arabic word]` | Parsing intent; SERPs are forum posts | ~3,140 |
| 4 | `what form is [arabic word]` / `[word] verb form` | Almost no structured coverage | ~3,140 |
| 5 | `form [N] verbs from root [X]` | Root × form intersection — nobody covers systematically | high |
| 6 | `arabic verb form II examples list` (×10 forms) | SERPs are blog prose; we can serve real attested examples | 10 |
| 7 | `arabic root and pattern system explained` | Evergreen explainer, funnels to root pages | 1 |
| 8 | `how to find the root of an arabic word` | High-intent beginner query | 1 |
| 9 | `arabic verbal noun / masdar of [root]` | Underserved, we hold the data | med |
| 10 | `arabic participle [active/passive] examples` | Underserved | few |
| 11 | `read arabic bible with english translation` | Existing but weak; corpus framing is distinct | few |
| 12 | `arabic bible vocabulary list` | Near-zero structured competition | few |
| 13 | `[bible book] in arabic with english` | Per-book, low volume, ~zero competition | 66 |
| 14 | `read arabic news with translation hover` | Competitors are extensions, not pages | 1 |
| 15 | `arabic word analyzer / morphology tool` | Mid competition, high intent | 1 |
| 16 | `learn arabic vocabulary by roots` | Strong topical fit for the wedge | 1 |
| 17 | `anki arabic deck roots` | Commercial intent, we have the drill | 1 |
| 18 | `book of mormon in arabic` | Zero competition, deferred until corpus exists | later |

**Priority for batch 1:** #1, #2, #5, #6 — these have the weakest SERPs and map directly onto
data we already hold at full quality.

---

## Phase 2 — Codebase & data audit

### Data inventory (verified by query)

| Source | Count | Notes |
|---|---|---|
| `bible_word_tags` | **11,541** words | surface PK, root, lemma, pos, verb_form, gloss — all tagged |
| — distinct roots | **1,229** | |
| — distinct lemmas | **3,140** | |
| — distinct verb forms | **10** | Forms I–X all represented |
| `root_meanings` | **316** roots | **Gap: 913 roots have no gloss** |
| `public/bible/word-skeleton-index.json` | 9,435 skeletons | derived, static, 1 MB |
| Bible chapter JSON | 1,189 files | fully vocalized Arabic + KJV parallel |

### Reusable

- `src/lib/morphology.ts` → `VERB_FORM_GLOSSES` — pattern, summary and a written explanation
  for all 10 forms. **Form pages are ~80% written already.**
- `src/lib/bible-root-index.ts` → `fetchWordsByRoot` — root→words logic, dedup by lemma.
  Port the query to the build script.
- `src/lib/arabic-normalize.ts` — normalization/skeleton logic for URL slugs and matching.
- `BibleWordPopover` / `WildWordPopover` — the *presentation* of a word's info is solved.

### Must be built new

- Root page, word page, form page, and index/hub pages — **none exist**. Word info currently
  only appears in hover popovers, never at a URL.
- Static page generation pipeline.
- Sitemap generation.
- Public (unauthenticated) route space.

### Technical risks

1. **Everything is behind auth.** `<Route path="/" element={<ProtectedRoute>…}>` — Googlebot
   cannot log in, so nothing is indexable today. SEO pages must be public.
2. **CSR-only SPA.** No SSR/SSG. JS-rendered content is a serious handicap for a zero-authority
   domain. → **Decision: build-time static HTML generation, not React SSR.** A Node script emits
   standalone HTML from the data. Avoids fighting auth/Supabase in a server context, guarantees
   crawlable HTML, and **touches zero existing app code** (satisfies the "don't break the drill"
   constraint).
3. **Duplicate content across two live origins** (github.io + netlify.app). Must choose one
   canonical and redirect/`rel=canonical` the other before adding indexable pages.
4. **Root gloss gap (913/1,229).** Mass-generating rootless-meaning pages = thin content risk.
   → Mitigation: generate only roots meeting a quality bar (see Phase 3).
5. **`index.html` is Lovable boilerplate** — title "Lovable App", Lovable OG image and Twitter
   handle. Currently the metadata for every route.
6. **Base path `/benarabic/`** — must become `/` on a custom domain; affects SW scope + assets.
7. **Licensing.** STEPBible tagged data is CC BY-SA 4.0 (share-alike). Attribution must appear
   on every generated page.

---

## Phase 3 — Information architecture

### Proposed brand: **Wazn** (وزن)

*Wazn* is the Arabic grammatical term for the **pattern a word is measured against** — literally
its "weight." "What's the wazn?" is what students actually ask when parsing a word. It names the
exact thing the app teaches, it's short and pronounceable in English, and it carries no religious
coding.

Runner-up: **Mizan** (ميزان) — *al-mīzān aṣ-ṣarfī* is the ف-ع-ل template system itself; nicer
imagery (a balance scale) but a more common word, so harder domain and mild Quranic resonance.

Domains to check: `wazn.app`, `getwazn.com`, `waznarabic.com`.

### Page types

| Type | URL | Count (eventual) | Content |
|---|---|---|---|
| Root | `/root/k-t-b` | 1,229 | Root in Arabic + transliteration, meaning, every form present, every lemma grouped by POS/form, attested example sentences w/ English, drill CTA |
| Word | `/word/kitab` | 3,140 | Lemma vocalized, POS, form, gloss, root link, sibling words, attested occurrences, drill CTA |
| Form | `/form/2` | 10 | Pattern, meaning, full explanation, **every verb of that form in the corpus** w/ examples |
| Hubs | `/roots`, `/words`, `/forms` | 3 | Browsable indexes, crawl paths |
| Explainers | `/guide/arabic-root-system` | ~3 | Evergreen, funnels into root pages |
| Text (later) | `/read/bible/matthew/1` | 1,189 | Deferred |

**URL convention:** Latin transliteration, lowercase, hyphenated (`/root/k-t-b`) — matches how
Wikipedia and corpus.quran.com do it, avoids percent-encoded Arabic, and matches how English
speakers actually search. Arabic script is prominent in the H1 and body.

### Metadata patterns

- Root title: `ك-ت-ب (k-t-b) — Arabic Root Meaning & Derived Words | Wazn`
- Root description: `The Arabic root ك-ت-ب means "writing." See all 23 words built from it — verbs by form, nouns, participles — each with vocalization, meaning, and real examples.`
- Word title: `كِتَاب (kitāb) — Meaning, Root & Form | Wazn`
- Form title: `Arabic Verb Form II (فَعَّلَ) — Meaning, Pattern & 84 Real Examples | Wazn`
- Structured data: `DefinedTerm` + `DefinedTermSet`, plus `BreadcrumbList`.

### Quality bar for generation (thin-content mitigation)

Generate a root page only if: **≥3 distinct lemmas** AND (**has a `root_meanings` gloss** OR
**≥5 attested words**). Quality over count for a zero-authority domain.

### Batch 1 (pending approval)

**35 pages:** 25 highest-quality root pages + 10 form pages + 3 hub pages.
Form pages are included in full because `VERB_FORM_GLOSSES` already supplies the prose and they
are genuinely strong standalone pages.

---

## Phase 4 — Build

_Not started. Awaiting Checkpoint 1 approval._

## Phase 5 — Ship & verify

_Not started._
