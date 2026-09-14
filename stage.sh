#!/usr/bin/env bash
# Sklada katalog do publikacji: dist/ z build.mjs + assets (bez originals) + klucz IndexNow.
# Uzycie: ./stage.sh <katalog-docelowy>   (zmienne BASE_PATH i SITE_ORIGIN przechodza do build.mjs)
set -euo pipefail
cd "$(dirname "$0")"
STAGE="${1:?Podaj katalog docelowy}"
node build.mjs
mkdir -p "$STAGE"
cp -R dist/. "$STAGE/"
rsync -a --exclude 'originals' assets/ "$STAGE/assets/"
cp "$(cat indexnow-key.txt).txt" "$STAGE/"
echo "staged: $STAGE"
