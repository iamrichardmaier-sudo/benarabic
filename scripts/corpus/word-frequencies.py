#!/usr/bin/env python3
"""Count how often each Arabic surface form occurs in a work.

The reader tags words by their exact surface spelling, so the corpus is
counted the same way: no normalisation, no stemming, just the tokens as the
text writes them. Anything that is not an Arabic letter or a diacritic ends a
token, which drops verse numbers, Latin text and punctuation without a
blocklist.

    python3 scripts/corpus/word-frequencies.py public/bom scripts/bom/bom-frequencies.json
"""
import json
import re
import sys
from pathlib import Path

# Arabic letters plus the marks that sit on them. The tatweel is stripped
# rather than kept: it is a typographic stretch, not part of the word.
TOKEN = re.compile(r'[ؠ-يٱ-ۓً-ْٰـ]+')


def count(directory: Path) -> dict[str, int]:
    freq: dict[str, int] = {}
    for path in sorted(directory.glob('*/*.json')):
        for verse in json.loads(path.read_text(encoding='utf8')):
            for token in TOKEN.findall(verse['a']):
                token = token.replace('ـ', '')
                if token:
                    freq[token] = freq.get(token, 0) + 1
    return freq


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    freq = count(Path(sys.argv[1]))
    ordered = dict(sorted(freq.items(), key=lambda kv: (-kv[1], kv[0])))
    Path(sys.argv[2]).write_text(
        json.dumps(ordered, ensure_ascii=False), encoding='utf8'
    )
    print(f'{len(ordered)} forms, {sum(ordered.values())} tokens')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
