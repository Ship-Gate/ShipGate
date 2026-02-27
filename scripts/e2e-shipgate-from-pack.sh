#!/usr/bin/env bash
# E2E: pack shipgate, install in a temp consumer project, run init / check / gate.
# Run from repo root. Use after build or to validate the published artifact shape.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLI="$ROOT/packages/cli"
CONSUMER=$(mktemp -d 2>/dev/null || mktemp -d -t shipgate-e2e)
trap 'rm -rf "$CONSUMER"' EXIT

echo "Building CLI..."
(cd "$CLI" && pnpm build)
echo "Packing..."
(cd "$CLI" && npm pack --ignore-scripts)
TARBALL=$(ls -t "$CLI"/shipgate-*.tgz 2>/dev/null | head -1)
[ -n "$TARBALL" ] || { echo "No tarball found"; exit 1; }
echo "Installing in consumer dir: $CONSUMER"
cd "$CONSUMER"
npm init -y
npm install "$TARBALL"
echo "Running shipgate --version..."
npx shipgate --version
echo "Running shipgate init..."
npx shipgate init my-app --directory "$CONSUMER/my-app"
[ -f "$CONSUMER/my-app/src/my-app.isl" ] || { echo "init did not create spec"; exit 1; }
echo "Running shipgate check..."
npx shipgate check "$CONSUMER/my-app/src/my-app.isl"
echo "Running shipgate gate..."
npx shipgate gate "$CONSUMER/my-app/src/my-app.isl" --impl "$CONSUMER/my-app/src" || true
echo "E2E from pack: OK"
