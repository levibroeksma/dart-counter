#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:4321}"
EMAIL="${AUTH_EMAIL:-test@example.com}"
PASS="${AUTH_PASSWORD:-testpass}"
ORIGIN_HEADER=(-H "Origin: $BASE_URL")
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

login() {
  curl -sf -c "$JAR" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" > /dev/null
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

HTML=$(curl -sf -b "$JAR" -X POST "$BASE_URL/games/ten-up-one-down" \
  -d "endMode=rounds&roundCount=2")
assert_contains "$HTML" 'tenUpOneDownPlay' "play page renders Alpine factory"
assert_contains "$HTML" 'data-testid="tuod-play-shell-skeleton"' "play shell skeleton present"
assert_contains "$HTML" 'data-testid="tuod-summary-skeleton"' "summary skeleton present"
assert_contains "$HTML" 'currentTarget&quot;:41' "session JSON embedded from POST"

COMPLETE_BODY='{"session":{"slug":"ten-up-one-down","settings":{"endMode":"rounds","roundCount":2},"state":{"currentRound":3,"currentTarget":39,"status":"completed","lastAdjustment":"failure"},"roundHistory":[{"roundNumber":1,"targetAtStart":41,"targetAfter":40,"finished":false,"dartsUsed":3,"dartsOnDouble":0},{"roundNumber":2,"targetAtStart":40,"targetAfter":39,"finished":false,"dartsUsed":3,"dartsOnDouble":0}],"timeRemainingSeconds":null,"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}}'
COMPLETE_RESP=$(curl -sf -b "$JAR" -X POST "$BASE_URL/api/games/ten-up-one-down/complete" \
  "${ORIGIN_HEADER[@]}" \
  -H "Content-Type: application/json" \
  -d "$COMPLETE_BODY")
assert_contains "$COMPLETE_RESP" '"ok":true' "complete endpoint accepts terminal session"
assert_contains "$COMPLETE_RESP" '"completionReason":"rounds"' "complete returns summary"

echo "All curl checks passed"
