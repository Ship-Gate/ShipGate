#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Build script for the shipgate CLI
#
# Bundles ALL workspace + npm dependencies into a single dist/cli.js so that
# `npx shipgate` works with zero extra installs.
#
# Usage:
#   bash scripts/build.sh          # build
#   bash scripts/build.sh --check  # build + verify output
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PKG_DIR"

echo "▸ Cleaning dist/"
rm -rf dist

echo "▸ Bundling CLI with tsup (CJS, node18 target, all deps bundled) …"
npx tsup

# Verify the shebang is present
if head -1 dist/cli.js | grep -q '#!/usr/bin/env node'; then
  echo "✓ Shebang present"
else
  echo "✗ ERROR: Missing shebang in dist/cli.js" >&2
  exit 1
fi

# Print bundle size
SIZE=$(wc -c < dist/cli.js | tr -d ' ')
SIZE_KB=$((SIZE / 1024))
SIZE_MB=$((SIZE_KB / 1024))

if [ "$SIZE_MB" -gt 10 ]; then
  echo "⚠ WARNING: Bundle is ${SIZE_MB}MB (>${10}MB target)" >&2
else
  echo "✓ Bundle size: ${SIZE_KB}KB (${SIZE_MB}MB)"
fi

# Optional: verify the CLI actually runs
if [[ "${1:-}" == "--check" ]]; then
  echo ""
  echo "▸ Smoke-checking built CLI …"

  echo -n "  --version: "
  node dist/cli.js --version

  echo -n "  verify --help: "
  if node dist/cli.js verify --help >/dev/null 2>&1; then
    echo "OK"
  else
    echo "FAIL" >&2
    exit 1
  fi

  echo -n "  init --help: "
  if node dist/cli.js init --help >/dev/null 2>&1; then
    echo "OK"
  else
    echo "FAIL" >&2
    exit 1
  fi

  echo ""
  echo "✓ All smoke checks passed"
fi

echo ""
echo "Done. Output: dist/cli.js (${SIZE_KB}KB)"
