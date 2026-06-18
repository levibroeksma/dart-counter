#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4321}"
EMAIL="${AUTH_EMAIL:-test@example.com}"
PASS="${AUTH_PASSWORD:-testpass}"
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

SETTINGS_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/settings")
assert_contains "$SETTINGS_HTML" "displayNameSetting" "settings page SSR"

PREFS_GET=$(curl -sf -b "$JAR" "$BASE_URL/api/settings/preferences")
assert_contains "$PREFS_GET" '"ok":true' "preferences GET"

PREFS_PUT=$(curl -sf -b "$JAR" -X PUT "$BASE_URL/api/settings/preferences" \
  -H "Content-Type: application/json" \
  -d '{"displayName":"CurlTest"}')
assert_contains "$PREFS_PUT" '"displayName":"CurlTest"' "preferences PUT"

PREFS_ROUNDTRIP=$(curl -sf -b "$JAR" "$BASE_URL/api/settings/preferences")
assert_contains "$PREFS_ROUNDTRIP" '"displayName":"CurlTest"' "preferences round-trip"

GAMES_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/games")
assert_contains "$GAMES_HTML" "Ten Up One Down" "games page catalog from DB"
assert_contains "$GAMES_HTML" "Score Training" "games page includes score-training"

HOME_HTML=$(curl -sf -b "$JAR" -L "$BASE_URL/")
assert_contains "$HOME_HTML" "Quick Start" "home page SSR"
assert_contains "$HOME_HTML" "Ten Up One Down" "quick start games from DB"

ORIGIN_HEADER=(-H "Origin: $BASE_URL")
CONFIG_PUT=$(curl -sf -b "$JAR" -X PUT "$BASE_URL/api/games/ten-up-one-down/config" \
  "${ORIGIN_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -d '{"settings":{"endMode":"rounds","roundCount":10}}')
assert_contains "$CONFIG_PUT" '"ok":true' "game config PUT"

CONFIG_GET=$(curl -sf -b "$JAR" "$BASE_URL/api/games/ten-up-one-down/config")
assert_contains "$CONFIG_GET" '"roundCount":10' "game config GET round-trip"

echo "All curl-verify-db checks passed"
