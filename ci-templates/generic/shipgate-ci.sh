#!/usr/bin/env bash
set -euo pipefail

# Shipgate Gate — Generic CI Script
# Works with any CI provider that supports Docker and bash
#
# Usage:
#   ./shipgate-ci.sh [spec_path] [impl_path] [threshold]
#
# Environment variables:
#   SHIPGATE_SPEC_PATH: Path to ISL spec file (default: specs/)
#   SHIPGATE_IMPL_PATH: Path to implementation directory (default: src/)
#   SHIPGATE_THRESHOLD: Minimum trust score (default: 95)
#   SHIPGATE_FAIL_ON_WARN: Set to "true" to fail on warnings (default: false)
#   SHIPGATE_IMAGE: Docker image (default: ghcr.io/shipgate/shipgate:v1)
#   USE_DOCKER: Set to "false" to use npm/npx instead of Docker (default: true)

SCAN_SPEC="${1:-${SHIPGATE_SPEC_PATH:-specs/}}"
SCAN_IMPL="${2:-${SHIPGATE_IMPL_PATH:-src/}}"
THRESHOLD="${3:-${SHIPGATE_THRESHOLD:-95}}"
FAIL_ON_WARN="${SHIPGATE_FAIL_ON_WARN:-false}"
SHIPGATE_IMAGE="${SHIPGATE_IMAGE:-ghcr.io/shipgate/shipgate:v1}"
USE_DOCKER="${USE_DOCKER:-true}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Shipgate Gate — Generic CI Runner"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Spec: $SCAN_SPEC"
echo "  Impl: $SCAN_IMPL"
echo "  Threshold: $THRESHOLD%"
echo "  Fail on WARN: $FAIL_ON_WARN"
echo "  Use Docker: $USE_DOCKER"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check if jq is available for JSON parsing
if command -v jq &> /dev/null; then
  USE_JQ=true
else
  USE_JQ=false
  echo "⚠️  Warning: jq not found, using basic parsing"
fi

# Function to run gate command
run_gate() {
  local spec_path="$1"
  local impl_path="$2"
  local threshold="$3"
  
  if [ "$USE_DOCKER" = "true" ]; then
    # Use Docker image
    echo "🐳 Running via Docker image: $SHIPGATE_IMAGE"
    docker run --rm \
      -v "$(pwd):/workspace" \
      -w /workspace \
      "$SHIPGATE_IMAGE" \
      gate "$spec_path" \
      --impl "$impl_path" \
      --threshold "$threshold" \
      --output ./evidence \
      --ci \
      --format json 2>&1 || true
  else
    # Use npm/npx
    echo "📦 Running via npm/npx"
    
    # Try to use local shipgate first
    if command -v shipgate &> /dev/null; then
      shipgate gate "$spec_path" \
        --impl "$impl_path" \
        --threshold "$threshold" \
        --output ./evidence \
        --ci \
        --format json 2>&1 || true
    else
      # Fallback to npx
      npx shipgate@latest gate "$spec_path" \
        --impl "$impl_path" \
        --threshold "$threshold" \
        --output ./evidence \
        --ci \
        --format json 2>&1 || true
    fi
  fi
}

# Run gate command
echo "🚦 Running Shipgate Gate..."
RESULT=$(run_gate "$SCAN_SPEC" "$SCAN_IMPL" "$THRESHOLD")
EXIT_CODE=$?

# Extract JSON from output (may have Docker/stderr noise)
JSON_MATCH=$(echo "$RESULT" | grep -o '\{.*\}' | head -1 || echo "")

if [ -z "$JSON_MATCH" ]; then
  echo "❌ Error: Could not parse Shipgate output"
  echo "$RESULT"
  exit 1
fi

# Save JSON to file
echo "$JSON_MATCH" > gate-result.json

# Parse verdict
if [ "$USE_JQ" = true ]; then
  VERDICT=$(echo "$JSON_MATCH" | jq -r '.decision // "NO-SHIP"' 2>/dev/null || echo "NO-SHIP")
  SCORE=$(echo "$JSON_MATCH" | jq -r '.trustScore // 0' 2>/dev/null || echo "0")
  CONFIDENCE=$(echo "$JSON_MATCH" | jq -r '.confidence // 0' 2>/dev/null || echo "0")
else
  # Basic parsing without jq
  VERDICT=$(echo "$JSON_MATCH" | grep -o '"decision":"[^"]*"' | cut -d'"' -f4 || echo "NO-SHIP")
  SCORE=$(echo "$JSON_MATCH" | grep -o '"trustScore":[0-9.]*' | cut -d':' -f2 || echo "0")
  CONFIDENCE=$(echo "$JSON_MATCH" | grep -o '"confidence":[0-9.]*' | cut -d':' -f2 || echo "0")
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Shipgate Gate Result"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Verdict: $VERDICT"
echo "  Trust Score: $SCORE/100"
echo "  Confidence: $CONFIDENCE%"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check for warnings (if WARN verdict exists)
if echo "$VERDICT" | grep -qi "WARN"; then
  if [ "$FAIL_ON_WARN" = "true" ]; then
    echo "⚠️  WARN verdict detected and FAIL_ON_WARN=true - failing build"
    exit 1
  else
    echo "⚠️  WARN verdict detected - continuing (set FAIL_ON_WARN=true to fail on warnings)"
  fi
fi

# Fail on NO-SHIP
if echo "$VERDICT" | grep -qi "NO-SHIP\|NO_SHIP"; then
  echo "❌ NO_SHIP verdict - blocking merge"
  if [ "$USE_JQ" = true ]; then
    echo "$JSON_MATCH" | jq -r '.reasons[]? | "  - \(.reason)"' 2>/dev/null || true
  fi
  exit 1
fi

# Success
if echo "$VERDICT" | grep -qi "SHIP"; then
  echo "✅ SHIP verdict - code approved"
  exit 0
fi

# Fallback: use exit code from gate command
if [ $EXIT_CODE -ne 0 ]; then
  echo "⚠️  Gate command exited with code $EXIT_CODE"
  exit $EXIT_CODE
fi

echo "✅ Gate completed successfully"
exit 0
