#!/usr/bin/env bash
# Fail if deep imports into barrel-enforced modules appear outside those modules.
# Covers src/ and tests/ including *.astro (excluded from ESLint).
#
# Allowed deep imports (mirrors eslint.config.js overrides):
#   - Files inside each module's own folder (src/lib/shared/<module>/**)
#   - Private-symbol test files listed below
#   - dartbot GeneratedCheckoutKnowledge.ts → @lib/shared/darts/checkout-hints.data
#     (allowed via dartbot module internal override)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

violations=0

check_module() {
  local label="$1"
  local pattern="$2"
  shift 2

  local -a rg_args=(-n --no-heading "$pattern" src tests -g '*.{ts,astro}')
  for glob in "$@"; do
    rg_args+=(--glob "$glob")
  done

  local matches=""
  matches="$(rg "${rg_args[@]}" 2>/dev/null || true)"

  if [[ -n "$matches" ]]; then
    echo "FAIL: forbidden deep imports into $label"
    echo "$matches"
    violations=$((violations + 1))
  else
    echo "PASS: no forbidden deep imports into $label"
  fi
}

# games/501 — private tests: leg-estimate, match, visit
check_module "games/501" '@lib/shared/games/501/' \
  '!src/lib/shared/games/501/**' \
  '!tests/lib/shared/games/501/leg-estimate.test.ts' \
  '!tests/lib/shared/games/501/match.test.ts' \
  '!tests/lib/shared/games/501/visit.test.ts'

# games/score-training — private tests: validation, state
check_module "games/score-training" '@lib/shared/games/score-training/' \
  '!src/lib/shared/games/score-training/**' \
  '!tests/lib/shared/games/score-training/validation.test.ts' \
  '!tests/lib/shared/games/score-training/state.test.ts'

# games/singles-training — private tests
check_module "games/singles-training" '@lib/shared/games/singles-training/' \
  '!src/lib/shared/games/singles-training/**' \
  '!tests/lib/shared/games/singles-training/dart.test.ts' \
  '!tests/lib/shared/games/singles-training/target-sequence.test.ts' \
  '!tests/lib/shared/games/singles-training/state.test.ts' \
  '!tests/lib/shared/games/singles-training/summary.test.ts' \
  '!tests/lib/shared/games/singles-training/stats.test.ts' \
  '!tests/lib/shared/games/singles-training/session-factory.test.ts' \
  '!tests/lib/shared/games/singles-training/completion.test.ts'

# games/ten-up-one-down — private tests: state, target
check_module "games/ten-up-one-down" '@lib/shared/games/ten-up-one-down/' \
  '!src/lib/shared/games/ten-up-one-down/**' \
  '!tests/lib/shared/games/ten-up-one-down/state.test.ts' \
  '!tests/lib/shared/games/ten-up-one-down/target.test.ts'

# dartbot — private tests: checkout-*, strategy-engine, throw-engine
check_module "dartbot" '@lib/shared/dartbot/' \
  '!src/lib/shared/dartbot/**' \
  '!tests/lib/shared/dartbot/checkout-planner.test.ts' \
  '!tests/lib/shared/dartbot/checkout-knowledge.test.ts' \
  '!tests/lib/shared/dartbot/strategy-engine.test.ts' \
  '!tests/lib/shared/dartbot/throw-engine.test.ts'

# darts — private test: doubles; dartbot GeneratedCheckoutKnowledge deep import
check_module "darts" '@lib/shared/darts/' \
  '!src/lib/shared/darts/**' \
  '!src/lib/shared/dartbot/checkout/GeneratedCheckoutKnowledge.ts' \
  '!tests/lib/shared/darts/doubles.test.ts'

# stats — no private test overrides
check_module "stats" '@lib/shared/stats/' \
  '!src/lib/shared/stats/**'

if [[ "$violations" -gt 0 ]]; then
  echo ""
  echo "FAIL: $violations module(s) with forbidden deep imports"
  exit 1
fi

echo ""
echo "All import audit checks passed"
exit 0
