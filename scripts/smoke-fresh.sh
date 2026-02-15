#!/usr/bin/env bash
# ShipGate Golden Path Smoke Test
# Proves ShipGate works end-to-end on a fresh checkout in <60s.
#
# Usage: ./scripts/smoke-fresh.sh
# Or:    pnpm smoke
#
# FAIL FAST: Prints which step broke and exits immediately.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="$ROOT/packages/cli/dist/cli.cjs"
FIXTURE="$ROOT/packages/cli/tests/fixtures/smoke-fresh"
INIT_DIR="$ROOT/packages/cli/tests/fixtures/smoke-init"

fail() {
  local step_num="$1"
  local step_name="$2"
  local cmd="$3"
  local output="${4:-}"
  echo ""
  echo "========================================"
  echo "  FAIL FAST: Step $step_num broke"
  echo "========================================"
  echo ""
  echo "  Step: $step_name"
  echo "  Command: $cmd"
  if [ -n "$output" ]; then
    echo ""
    echo "  Output:"
    echo "  ---"
    echo "$output" | sed 's/^/  /'
    echo "  ---"
  fi
  echo ""
  exit 1
}

step() {
  echo "[$1] $2"
}

cd "$ROOT"

# Step 1: Install
step "1/6" "pnpm install..."
OUTPUT=$(pnpm install --frozen-lockfile 2>&1) || fail "1" "pnpm install" "pnpm install --frozen-lockfile" "$OUTPUT"
echo "  ✓ install"

# Step 2: Build
step "2/6" "pnpm build..."
OUTPUT=$(pnpm build 2>&1) || fail "2" "pnpm build" "pnpm build" "$OUTPUT"
echo "  ✓ build"

# Step 3: CLI --help
step "3/6" "shipgate --help..."
OUTPUT=$(node "$CLI" --help 2>&1) || fail "3" "shipgate --help" "node $CLI --help" "$OUTPUT"
echo "  ✓ --help"

# Step 4: init
step "4/6" "shipgate init..."
rm -rf "$INIT_DIR"
mkdir -p "$INIT_DIR"
OUTPUT=$(node "$CLI" init smoke-init --directory "$INIT_DIR" 2>&1) || fail "4" "shipgate init" "node $CLI init smoke-init --directory $INIT_DIR" "$OUTPUT"
echo "  ✓ init"

# Step 5: verify
step "5/6" "shipgate verify..."
OUTPUT=$(node "$CLI" verify "$FIXTURE/spec.isl" --impl "$FIXTURE/impl.ts" 2>&1) || fail "5" "shipgate verify" "node $CLI verify $FIXTURE/spec.isl --impl $FIXTURE/impl.ts" "$OUTPUT"
echo "  ✓ verify"

# Step 6: gate
step "6/6" "shipgate gate..."
OUTPUT=$(node "$CLI" gate "$FIXTURE/spec.isl" --impl "$FIXTURE/impl.ts" --threshold 80 --format json 2>&1) || fail "6" "shipgate gate" "node $CLI gate $FIXTURE/spec.isl --impl $FIXTURE/impl.ts --threshold 80" "$OUTPUT"
echo "  ✓ gate"

echo ""
echo "========================================"
echo "  ShipGate smoke: PASSED"
echo "========================================"
echo ""
exit 0
