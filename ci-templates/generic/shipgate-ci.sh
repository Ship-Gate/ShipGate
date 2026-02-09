#!/usr/bin/env bash
set -euo pipefail

# Shipgate ISL Verify — Generic CI Script
# Works with any CI provider that supports Docker and bash
#
# Usage:
#   ./shipgate-ci.sh [path] [FAIL_ON=error]
#
# Environment variables:
#   FAIL_ON: error (default) | warning | unspecced
#   SHIPGATE_IMAGE: Docker image (default: ghcr.io/shipgate/shipgate:v1)

SCAN_PATH="${1:-.}"
FAIL_ON="${FAIL_ON:-error}"
SHIPGATE_IMAGE="${SHIPGATE_IMAGE:-ghcr.io/shipgate/shipgate:v1}"

echo "Shipgate ISL Verify"
echo "==================="
echo "Path: $SCAN_PATH"
echo "Fail on: $FAIL_ON"
echo "Image: $SHIPGATE_IMAGE"
echo ""

# Check if jq is available for JSON parsing
if command -v jq &> /dev/null; then
  USE_JQ=true
else
  USE_JQ=false
  echo "Warning: jq not found, using basic parsing"
fi

# Run verification
RESULT=$(docker run --rm -v "$(pwd):/workspace" -w /workspace "$SHIPGATE_IMAGE" verify "$SCAN_PATH" --ci --json 2>&1 || true)

# Extract JSON from output (may have Docker/stderr noise)
JSON_MATCH=$(echo "$RESULT" | grep -o '\{.*\}' | head -1 || echo "")

if [ -z "$JSON_MATCH" ]; then
  echo "Error: Could not parse Shipgate output"
  echo "$RESULT"
  exit 1
fi

# Parse verdict
if [ "$USE_JQ" = true ]; then
  VERDICT=$(echo "$JSON_MATCH" | jq -r '.verdict // "NO_SHIP"')
  SCORE=$(echo "$JSON_MATCH" | jq -r '.score // 0')
else
  # Basic parsing without jq
  VERDICT=$(echo "$JSON_MATCH" | grep -o '"verdict":"[^"]*"' | cut -d'"' -f4 || echo "NO_SHIP")
  SCORE=$(echo "$JSON_MATCH" | grep -o '"score":[0-9.]*' | cut -d':' -f2 || echo "0")
fi

echo "Shipgate verdict: $VERDICT (score: $SCORE)"
echo ""

# Print full JSON for artifact capture
echo "$JSON_MATCH" > shipgate-result.json

# Determine exit code
if [ "$VERDICT" = "NO_SHIP" ]; then
  echo "❌ Shipgate: NO_SHIP"
  exit 1
elif [ "$VERDICT" = "WARN" ]; then
  if [ "$FAIL_ON" = "warning" ]; then
    echo "⚠️  Shipgate: WARN (failing because FAIL_ON=warning)"
    exit 1
  else
    echo "⚠️  Shipgate: WARN"
    exit 0
  fi
else
  echo "✅ Shipgate: SHIP"
  exit 0
fi
