# Annotating a root: the spec

You are building rows for the shared Arabic word bank (`public.words`) of a learner's app. For each
root in your shard you produce every Qur'anic content word of that root **and** the other real,
reasonably common words of the same root that a learner will meet in modern written Arabic. A learner
will study these words later; wrong vowels or a wrong gloss teach the wrong thing, so **quality beats
quantity: leave out anything you are not sure is a real, correctly voweled word.**

You write one file, `WORK/out/<SHARD>.jsonl`, and check it with the validator. You never touch the
database, git, or any other file.

## Inputs

* `WORK/shards/<SHARD>.json` lists your dossier numbers. Read each `WORK/dossiers/NNNN.txt` (4-digit,
  zero padded). A dossier shows: the Qur'an's content words for the root (verb forms, lemmas,
  participles, with a sample reference and the quran.com word-by-word hint, which is only a hint), the
  words the bank already holds for the root, and Wiktionary's list for the root (verify before using).
* `python3 /home/user/benarabic/scripts/quran/quran_words.py verse 2:255 --work WORK` prints a verse as
  numbered words, so you can choose an excerpt span.
* `python3 /home/user/benarabic/scripts/quran/quran_words.py root ك-ت-ب --work WORK` reprints a dossier.
* `python3 /home/user/benarabic/scripts/quran/quran_words.py check <SHARD> --work WORK` validates your
  file. **Run it until it exits 0.** It enforces coverage: every Qur'an verb form and lemma of your roots
  must be an entry or an explicit skip.

## What to write for each root

1. **Every Qur'an group in the dossier** becomes an entry, with these exceptions, each written as a
   skip line (below): an inflected spelling of a word you already list (plural, dual, a pronoun suffix,
   a different case), a spelling variant, a function word that slipped through (إِذَا, يَوْمَئِذ, لَدَى),
   or an unclassified lemma that is the same word as an entry you wrote.
2. **Related words beyond scripture** (`"src": "msa"`): the other verb forms the root really has (I–X),
   each verb's masdar, the real active and passive participles, common nouns, adjectives, nouns of
   place or instrument, relative adjectives. Take candidates from the dossier's Wiktionary list and your
   own knowledge. Only words that exist and are in use. Do not generate mechanically; a pattern that is
   grammatical but unattested is not a word. Typical root: 5 to 20 entries; a rich root up to about 30.
3. Words the bank already holds for the root (the dossier's BANK section) are **not re-added**. If you
   write one by mistake the validator warns; delete it. Do write the neighbours the bank lacks.

## Entry format (one JSON object per line, UTF-8)

| field | rules |
|---|---|
| `w` | the headword, **fully voweled**, bare: no definite article, no clitic, no tanwin or case ending. Verbs: 3rd masculine singular past (`كَتَبَ`). Nouns: singular (`كِتاب`). A noun used only in the plural in scripture is listed as that plural with `"kind": "plural"`. |
| `en` | everyday English meaning in 1 to 5 words, no full stop, no leading article. Verbs start `to ` (`to write`). If scripture uses a different sense from modern usage, give the common sense in `en` and explain in `note`. |
| `root` | `ك-ت-ب`: letters joined by `-`, **every hamza written أ** (`س-أ-ل`, `ش-ي-أ`). It must be one of your shard's roots. |
| `type` | `verb`, `masdar`, `noun`, `adjective`, `participle` or `other` |
| `kind` | verb: `verb`. masdar: `masdar`. participle: `active participle` or `passive participle`. noun: `noun`, `noun of place`, `noun of instrument`, `noun of instance`, `collective noun`, `plural`, `diminutive`. adjective: `adjective`, `comparative`, `relative adjective`, `intensive adjective`. other: `adverb`, `expression`. |
| `form` | `I` to `X`. Required for verbs, and for masdars and participles (the form of the verb they derive from). |
| `past`, `pres`, `masdar` | verbs only, fully voweled: `past` equals `w`; `pres` is 3rd masculine singular present indicative (`يَكْتُبُ`); `masdar` the usual verbal noun (`كِتابَة`). |
| `gender` | `m` or `f` for nouns (required for `noun`, `noun of place`, ...). Judge the word, not the ending: `أُمّ`, `أَرض`, `شَمس`, `عَين`, `يَد`, `نَفس` are feminine. |
| `plural` | the usual plural, fully voweled (broken plural where the word takes one). Omit with `"noplural": true` for mass or abstract nouns. Also give it for adjectives and participles that take one. |
| `src` | `quran` if the word (this lexeme) occurs in the Qur'an, else `msa` |
| `q`, `qen` | the Qur'an excerpt. `q` is `"c:v:first-last"`, word numbers from the `verse` command. Required for `src: quran`; for `msa` words add one only if a verse genuinely shows that same word. Choose the **shortest span (usually 3 to 9 words, never more than 14)** that makes sense and clearly contains the word. `qen` is your own plain-English rendering of exactly that span (a phrase, not a whole verse), no Arabic. Never type the Arabic of the verse; the pipeline copies it. |
| `see` | optional, up to 2 semantic links outside the root: `[{"w": "صَحيفة", "label": "Synonym (page, scroll)"}]`. Labels: `Synonym (...)`, `Opposite (...)`, `Often paired with (...)`. Only well-known, certain pairs. |
| `note` | optional, one sentence on usage or on a Qur'anic sense that differs from modern usage |
| `override` | rare escape hatch, a one-line reason. The validator rejects a word that lacks its root's letters (فَم, "mouth", has lost the ه of ف-و-ه) and an excerpt with no word of the root according to the corpus's single root assignment (فَواق, فُوم and a few others are assigned another root). If you are **certain** the word is of this root and the verse really contains it, set `"override": "why"`; it is reported for review. Use it for at most a handful of entries, never to silence a doubt: when in doubt, leave the word out. |

Homographs that share one bare spelling (a verb and a participle with the same letters) are normal;
write both, the merge step disambiguates. Do not invent disambiguators.

### Skip lines

```
{"skip": "كِتَٰبِى", "why": "كِتاب with the pronoun suffix ي"}          lemma exactly as the dossier prints it
{"skip": "V:II", "why": "..."}                                          a verb form you decide is not a separate lexeme
```

### Gold example (root ك-ت-ب, abridged)

```
{"w":"كَتَبَ","en":"to write","root":"ك-ت-ب","type":"verb","kind":"verb","form":"I","past":"كَتَبَ","pres":"يَكْتُبُ","masdar":"كِتابَة","src":"quran","q":"2:79:3-5","qen":"who write the Book with their own hands"}
{"w":"كاتَبَ","en":"to correspond with","root":"ك-ت-ب","type":"verb","kind":"verb","form":"III","past":"كاتَبَ","pres":"يُكاتِبُ","masdar":"مُكاتَبة","src":"quran","q":"24:33:17-17","qen":"then give them a written contract of freedom","note":"In 24:33 it is the manumission contract; in modern usage, to exchange letters."}
{"w":"كِتاب","en":"book","root":"ك-ت-ب","type":"noun","kind":"noun","gender":"m","plural":"كُتُب","src":"quran","q":"2:2:1-5","qen":"This is the Book, in which there is no doubt","see":[{"w":"صَحيفة","label":"Synonym (page, scroll)"}]}
{"w":"كاتِب","en":"writer, scribe","root":"ك-ت-ب","type":"participle","kind":"active participle","form":"I","gender":"m","plural":"كُتّاب","src":"quran","q":"2:282:12-14","qen":"and let a scribe write between you"}
{"w":"مَكْتوب","en":"written","root":"ك-ت-ب","type":"participle","kind":"passive participle","form":"I","src":"quran","q":"7:157:7-8","qen":"whom they find written down"}
{"w":"كِتابَة","en":"writing","root":"ك-ت-ب","type":"masdar","kind":"masdar","form":"I","gender":"f","src":"msa"}
{"w":"كَتيبة","en":"battalion","root":"ك-ت-ب","type":"noun","kind":"noun","gender":"f","plural":"كَتائِب","src":"msa"}
```

## Working method

1. Read your shard file, then your dossiers in order. Work in groups of 5 to 10 roots.
2. After each group, **append** to your file (`cat >> WORK/out/<SHARD>.jsonl <<'EOF' ... EOF`). Do not
   rewrite the whole file; do not hold all your roots in your head.
3. Run `check` after every few groups and fix errors as you go. Warnings about bank duplicates and
   shared spellings need a look but are not failures.
4. When `check` exits 0, reply with **three lines**: shard id, entry count, and anything you were unsure
   about (roots where you left words out because you doubted them). Nothing else.

## Hard rules

* Quality: if you are not certain a form is a real word with the vowels you give, omit it.
* Do not copy glosses verbatim from a source; write your own short ones.
* Names of persons or places, numbers and loanwords belong to the rootless shard, not to a root shard.
* Never write outside `WORK/out/<SHARD>.jsonl`. Never run `git`, never touch the database, never read
  other shards' output.
