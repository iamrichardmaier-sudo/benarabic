#!/usr/bin/env bash
# One-time setup for the calligram tools: a text shaper and the fonts.
# Everything lands in .cache/ (git-ignored); the app's own dependencies are
# not touched. Playwright is used from wherever it is installed globally.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p .cache/fonts
[ -d .cache/node_modules/harfbuzzjs ] || npm i --no-save --prefix .cache harfbuzzjs@0.4.6 >/dev/null
fetch() { [ -f ".cache/fonts/$1.ttf" ] || curl -sS "$2" -o ".cache/fonts/$1.ttf"; }
# Google Fonts serves TTF to a client that does not ask for WOFF2.
fetch amiri-bold  https://fonts.gstatic.com/s/amiri/v30/J7acnpd8CGxBHp2VkZY4.ttf
fetch aref-ruqaa  https://fonts.gstatic.com/s/arefruqaa/v26/WwkYxPW1E165rajQKDulKDwNcNI.ttf
fetch rakkas      https://fonts.gstatic.com/s/rakkas/v22/Qw3cZQlNHiblL3j_lg.ttf
fetch reem-kufi   https://fonts.gstatic.com/s/reemkufi/v28/2sDPZGJLip7W2J7v7wQZZE1I0yCmYzzQtgFgEGE.ttf
echo "calligram tools ready"
