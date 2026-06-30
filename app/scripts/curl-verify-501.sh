#!/usr/bin/env bash
# app/scripts/curl-verify-501.sh
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4321}"
EMAIL="${AUTH_EMAIL:-test@example.com}"
PASS="${AUTH_PASSWORD:-testpass}"
ORIGIN_HEADER=(-H "Origin: $BASE_URL")
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if ! printf '%s' "$haystack" | grep -q "$needle"; then
    echo "FAIL: $label — expected substring: $needle"
    exit 1
  fi
  echo "PASS: $label"
}

login() {
  curl -sf -c "$JAR" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null
}

login
echo "Logged in"

GAMES_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/games")
assert_contains "$GAMES_HTML" "settings-501" "games page lists 501"

SETTINGS_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/games/settings-501")
assert_contains "$SETTINGS_HTML" "fiveOhOneSettings" "settings page renders Alpine factory"
assert_contains "$SETTINGS_HTML" "Guest" "settings includes opponent picker"

PLAYERS_JSON='[{"id":"00000000-0000-4000-8000-000000000099","type":"user","name":"CurlTest"}]'
HTML=$(curl -sf -b "$JAR" -X POST "$BASE_URL/games/501" \
  "${ORIGIN_HEADER[@]}" \
  --data-urlencode "matchMode=first-to" \
  --data-urlencode "targetCount=1" \
  --data-urlencode "unit=legs" \
  --data-urlencode "players=$PLAYERS_JSON")
assert_contains "$HTML" "fiveOhOnePlay" "play page renders Alpine factory from POST"
assert_contains "$HTML" 'class="skeleton' "play shell skeleton present"

COMPLETE_BODY=$(npx tsx scripts/fixtures/build-completed-501-session.ts)
COMPLETE_RESP=$(curl -sf -b "$JAR" -X POST "$BASE_URL/api/games/501/complete" \
  "${ORIGIN_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -d "$COMPLETE_BODY")
assert_contains "$COMPLETE_RESP" '"ok":true' "complete endpoint accepts terminal session"
assert_contains "$COMPLETE_RESP" '"resultLabel"' "complete returns summary"

echo "All curl checks passed"
