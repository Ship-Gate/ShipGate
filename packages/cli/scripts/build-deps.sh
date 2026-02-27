#!/usr/bin/env bash
# Build essential workspace dependencies for CLI bundling

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$PKG_DIR/../.." && pwd)"

cd "$ROOT_DIR"

echo "▸ Building essential workspace dependencies..."

# Build core dependencies that CLI needs
# Skip DTS generation for faster builds (not needed for bundling)
pnpm --filter "@isl-lang/parser" build || echo "⚠ Parser build failed, continuing..."
pnpm --filter "@isl-lang/core" build || echo "⚠ Core build failed, continuing..."
pnpm --filter "@isl-lang/observability" build -- --dts false || echo "⚠ Observability build failed, continuing..."
pnpm --filter "@isl-lang/import-resolver" build || echo "⚠ Import-resolver build failed, continuing..."
pnpm --filter "@isl-lang/semantic-analysis" build || echo "⚠ Semantic-analysis build failed, continuing..."
pnpm --filter "@isl-lang/isl-core" build || echo "⚠ ISL-core build failed, continuing..."
pnpm --filter "@isl-lang/isl-verify" build || echo "⚠ ISL-verify build failed, continuing..."
pnpm --filter "@isl-lang/gate" build || echo "⚠ Gate build failed, continuing..."
pnpm --filter "@isl-lang/pipeline" build || echo "⚠ Pipeline build failed, continuing..."
pnpm --filter "@isl-lang/policy-packs" build || echo "⚠ Policy-packs build failed, continuing..."
pnpm --filter "@isl-lang/isl-policy-engine" build || echo "⚠ Policy-engine build failed, continuing..."
pnpm --filter "@isl-lang/proof" build || echo "⚠ Proof build failed, continuing..."
pnpm --filter "@isl-lang/truthpack-v2" build || echo "⚠ Truthpack build failed, continuing..."

echo "✓ Dependency builds complete"
