#!/usr/bin/env bash
# Deploy na Cloudflare Pages (projekt: ramnevercomes).
# Token: CLOUDFLARE_API_TOKEN z env albo z .env (wymagane uprawnienie Account -> Cloudflare Pages -> Edit).
set -euo pipefail
cd "$(dirname "$0")"

[ -f .env ] && . ./.env
: "${CLOUDFLARE_API_TOKEN:?Brak CLOUDFLARE_API_TOKEN - ustaw w env albo w .env}"
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-664c66a2b8712b3921b616c2cb623b31}"

# przypomnienie o wersji cache service workera
LOCAL_V=$(grep -o "rambuy-v[0-9]*" sw.js | head -1)
PROD_V=$(curl -s --max-time 10 https://ramnevercomes.com/sw.js | grep -o "rambuy-v[0-9]*" | head -1 || true)
if [ -n "$PROD_V" ] && [ "$PROD_V" = "$LOCAL_V" ]; then
  echo "UWAGA: CACHE w sw.js ($LOCAL_V) ma te sama wersje co produkcja - powracajacy uzytkownicy nie zobacza zmian bez bumpa."
fi

node build.mjs

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -R dist/ "$STAGE/"
rsync -a --exclude 'originals' assets/ "$STAGE/assets/"
KEY=$(cat indexnow-key.txt)
cp robots.txt "$KEY.txt" "$STAGE/"  # sitemap.xml generuje build.mjs do dist/

npx wrangler pages deploy "$STAGE" --project-name=ramnevercomes --branch=main

# IndexNow: pingnij Bing/Yandex lista URL-i z sitemap (nie blokuje deployu przy bledzie)
URLS=$(grep -o '<loc>[^<]*</loc>' dist/sitemap.xml | sed 's/<[^>]*>//g' | sed 's/.*/"&"/' | paste -sd, -)
curl -s -m 20 -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "{\"host\":\"ramnevercomes.com\",\"key\":\"$KEY\",\"keyLocation\":\"https://ramnevercomes.com/$KEY.txt\",\"urlList\":[$URLS]}" \
  -o /dev/null -w "IndexNow ping: HTTP %{http_code}\n" || true

echo "OK: https://ramnevercomes.com/"
