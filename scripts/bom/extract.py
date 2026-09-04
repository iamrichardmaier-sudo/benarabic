"""Turn the parallel Book of Mormon PDF into the chapter JSON the reader uses.

The PDF lays each verse out as a number, an Arabic block, then the English
block beside it, which is exactly the {v, a, e} shape the Bible chapters
already use — so the reader, the parallel view and the tagger all work on it
unchanged.

Two repairs are needed on the way out, both from the same cause: the embedded
fonts carry a ToUnicode map that is wrong for a handful of glyphs.

  Arabic   Four glyphs land on Latin or control characters. Every one is an
           alef in a lam-alef ligature, verified by reading the repaired words
           against the English beside them.

  English  The "ft" ligature maps to a bare "f", so every English word
           containing "ft" lost its t — 714 tokens. The map below was built by
           taking each extracted word that is not an English word, restoring a
           t after each f, and keeping the result only where that produced one.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import fitz  # PyMuPDF

# Broken glyph mappings in the Arabic font.
ARABIC_REPAIRS = {"W": "ا", "\x81": "أ", "¿": "إ", "\x98": "أَ"}

# The ft-ligature casualties. "nify" and "rify" were also flagged by the
# dictionary pass but appear once each with no readable context, so they are
# left alone: a wrong repair is worse than an odd token.
FT_REPAIRS = {
    "afer": "after", "lef": "left", "fifh": "fifth", "fify": "fifty",
    "hereafer": "hereafter", "graf": "graft", "grafed": "grafted",
    "sofen": "soften", "crafiness": "craftiness", "fifeenth": "fifteenth",
    "ofen": "often", "priestcraf": "priestcraft", "swif": "swift",
    "lofy": "lofty", "lifing": "lifting", "lofiness": "loftiness",
    "craf": "craft", "sif": "sift", "grafing": "grafting", "shaf": "shaft",
    "sofly": "softly", "aferwards": "afterwards", "twelfh": "twelfth",
    "swifness": "swiftness", "fifieth": "fiftieth", "sofening": "softening",
    "fifeen": "fifteen", "witchcraf": "witchcraft", "swifer": "swifter",
}

BOOK_CODES = {
    "1 Nephi": "1Ne", "2 Nephi": "2Ne", "Jacob": "Jacob", "Enos": "Enos",
    "Jarom": "Jarom", "Omni": "Omni", "Words of Mormon": "WofM",
    "Mosiah": "Mosiah", "Alma": "Alma", "Helaman": "Hel", "3 Nephi": "3Ne",
    "4 Nephi": "4Ne", "Mormon": "Morm", "Ether": "Ether", "Moroni": "Moro",
}

# The one-chapter books run a title across the head instead of a number.
SINGLE_CHAPTER = {
    "The Book of Enos": "Enos",
    "The Book of Jarom": "Jarom",
    "The Book of Omni": "Omni",
    "The Words of Mormon": "WofM",
    "Fourth Nephi": "4Ne",
}

ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩"
# No \b before the name: the running head glues the Arabic chapter number to
# the English one ("٥1 Nephi 5"), and an Arabic-Indic digit is a word character,
# so a word boundary never appears there.
HEADER = re.compile(r"(?<![A-Za-z])(1 Nephi|2 Nephi|3 Nephi|4 Nephi|Words of Mormon|"
                    r"Jacob|Enos|Jarom|Omni|Mosiah|Alma|Helaman|Mormon|Ether|Moroni)"
                    r"\s+(\d+)(?![\d])")


def is_arabic(ch: str) -> bool:
    return "؀" <= ch <= "ۿ"


def repair(text: str) -> str:
    """Fix the Arabic glyphs, and only the Arabic ones.

    "W" is the alef of a lam-alef ligature 3,441 times — and an ordinary
    English capital W 374 times, "Wherefore" alone accounting for 183 of them.
    A global replace silently eats those, so a character is only repaired where
    Arabic actually stands next to it.
    """
    text = unicodedata.normalize("NFKC", text)
    out = []
    for i, ch in enumerate(text):
        good = ARABIC_REPAIRS.get(ch)
        if good and (
            (i and is_arabic(text[i - 1])) or (i + 1 < len(text) and is_arabic(text[i + 1]))
        ):
            out.append(good)
        else:
            out.append(ch)
    return "".join(out)


def repair_english(text: str) -> str:
    def sub(m: re.Match) -> str:
        word = m.group(0)
        fixed = FT_REPAIRS.get(word.lower())
        if not fixed:
            return word
        return fixed.capitalize() if word[0].isupper() else fixed
    return re.sub(r"[A-Za-z]+", sub, text)


def verse_number(line: str):
    """A line that is nothing but Arabic-Indic digits starts a verse.

    The digits come out in visual order, so 10 extracts as ٠١ and has to be
    read back to front.
    """
    stripped = line.strip()
    if not stripped or any(c not in ARABIC_INDIC for c in stripped):
        return None
    digits = "".join(str(ARABIC_INDIC.index(c)) for c in reversed(stripped))
    return int(digits)


def split_scripts(line: str):
    """Arabic and English sometimes share an extracted line. Cut at the join.

    The two runs meet with no space and often with punctuation between them —
    "…الرَبِ.And it came to pass", "…الرَبِ—And he spake". Cutting only where a
    Latin letter directly follows an Arabic one misses both, and the whole line
    then lands in the Arabic column while the English is lost altogether.

    So: cut at the first Latin letter that has Arabic somewhere before it. The
    punctuation stays on the Arabic side, which is where it belongs — it closes
    the Arabic sentence.
    """
    seen_arabic = False
    for i, ch in enumerate(line):
        if is_arabic(ch):
            seen_arabic = True
        elif seen_arabic and ch.isascii() and ch.isalpha():
            return line[:i], line[i:]
    return line, ""


def join_english(parts):
    """Undo the PDF's hard line wrapping, including hyphenated breaks."""
    text = ""
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if text.endswith("-"):
            text = text[:-1] + part
        elif text:
            text += " " + part
        else:
            text = part
    return re.sub(r"\s+", " ", text).strip()


def extract(pdf_path: Path):
    doc = fitz.open(pdf_path)
    chapters = {}          # (book_code, chapter) -> {verse: {"a": [], "e": []}}
    where = None           # current (book_code, chapter)
    verse = None
    for page in doc:
        lines = repair(page.get_text()).split("\n")
        for raw in lines:
            single = next((c for t, c in SINGLE_CHAPTER.items() if t in raw), None)
            if single:
                where = (single, 1)
                chapters.setdefault(where, {})
                verse = None
                continue
            header = HEADER.search(raw)
            if header:
                book = BOOK_CODES[header.group(1)]
                where = (book, int(header.group(2)))
                chapters.setdefault(where, {})
                verse = None
                # A header line carries no verse text of its own.
                continue
            if where is None:
                continue
            number = verse_number(raw)
            if number is not None:
                verse = number
                chapters[where].setdefault(verse, {"a": [], "e": []})
                continue
            if verse is None:
                continue
            arabic, english = split_scripts(raw)
            if any(is_arabic(c) for c in arabic):
                chapters[where][verse]["a"].append(arabic.strip())
            if english.strip():
                chapters[where][verse]["e"].append(english.strip())
            elif not any(is_arabic(c) for c in arabic) and arabic.strip():
                chapters[where][verse]["e"].append(arabic.strip())
    return chapters


def main() -> int:
    pdf = Path(sys.argv[1] if len(sys.argv) > 1 else "parallel-bofm-ara-eng.pdf")
    out = Path(sys.argv[2] if len(sys.argv) > 2 else "public/bom")
    chapters = extract(pdf)

    out.mkdir(parents=True, exist_ok=True)
    written = verses = 0
    for (book, chapter), found in sorted(chapters.items()):
        rows = []
        for number in sorted(found):
            arabic = re.sub(r"\s+", " ", " ".join(found[number]["a"])).strip()
            english = repair_english(join_english(found[number]["e"]))
            if not arabic and not english:
                continue
            rows.append({"v": number, "a": arabic, "e": english})
        if not rows:
            continue
        (out / book).mkdir(parents=True, exist_ok=True)
        (out / book / f"{chapter}.json").write_text(
            json.dumps(rows, ensure_ascii=False), encoding="utf-8")
        written += 1
        verses += len(rows)
    print(f"{written} chapters, {verses} verses -> {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
