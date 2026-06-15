#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4321}"
USER="${AUTH_USERNAME:-testuser}"
PASS="${AUTH_PASSWORD:-testpass}"
ORIGIN_HEADER=(-H "Origin: $BASE_URL")
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

login() {
  curl -sf -c "$JAR" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" > /dev/null
}

assert_contains() {
  local haystack="$1" needle="$2" label="$3"
  if ! printf '%s' "$haystack" | grep -q "$needle"; then
    echo "FAIL: $label — expected substring: $needle"
    exit 1
  fi
  echo "PASS: $label"
}

login
echo "Logged in"

curl -sf -b "$JAR" -X DELETE "$BASE_URL/api/games/ten-up-one-down/session" "${ORIGIN_HEADER[@]}" > /dev/null

SESSION_RESP=$(curl -sf -b "$JAR" -X POST "$BASE_URL/api/games/ten-up-one-down/session" \
  "${ORIGIN_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -d '{"endMode":"rounds","roundCount":10}')
assert_contains "$SESSION_RESP" '"ok":true' "session created"

HTML=$(curl -sf -b "$JAR" "$BASE_URL/games/ten-up-one-down")
assert_contains "$HTML" 'data-testid="tuod-number-pad"' "play page renders NumberInputPad"
assert_contains "$HTML" 'data-testid="tuod-score-display"' "play page renders score display"

echo "All curl checks passed"
