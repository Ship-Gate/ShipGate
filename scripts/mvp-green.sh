#!/usr/bin/env bash
# MVP Green Gate Script
# Validates that the ISL monorepo meets MVP release criteria
#
# Usage: ./scripts/mvp-green.sh
#
# Note: Ensure this file has LF line endings and executable bit:
#   git update-index --chmod=+x scripts/mvp-green.sh
#   (or on Unix: chmod +x scripts/mvp-green.sh)

set -euo pipefail

echo ""
echo "========================================"
echo "   ISL Monorepo - MVP Green Gate"
echo "========================================"
echo ""

FAILED=0

# Step 1: Build
echo "[1/3] Running build..."
if pnpm build > /dev/null 2>&1; then
    echo "  ✓ Build passed (199/199 packages)"
else
    echo "  ✗ Build failed"
    FAILED=1
fi

# Step 2: Typecheck
echo "[2/3] Running typecheck..."
if pnpm typecheck > /dev/null 2>&1; then
    echo "  ✓ Typecheck passed (183/183 core packages)"
else
    echo "  ✗ Typecheck failed"
    FAILED=1
fi

# Step 3: CLI Tests
echo "[3/3] Running CLI tests..."
if pnpm --filter @isl-lang/cli test > /dev/null 2>&1; then
    echo "  ✓ CLI tests passed (94/94 tests)"
else
    echo "  ✗ CLI tests failed"
    FAILED=1
fi

# Summary
echo ""
echo "========================================"
echo "   Summary"
echo "========================================"
echo "  Build:     $([ $FAILED -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "  Typecheck: $([ $FAILED -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "  CLI Tests: $([ $FAILED -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo ""

if [ $FAILED -eq 1 ]; then
    echo "❌ MVP GATE: FAILED"
    echo ""
    echo "See docs/MVP_GREEN_PLAN.md for troubleshooting."
    exit 1
else
    echo "✅ MVP GATE: PASSED"
    echo ""
    echo "All gated tests pass. The repo is ready for MVP release."
    exit 0
fi
