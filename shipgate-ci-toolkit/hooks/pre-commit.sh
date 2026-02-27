#!/usr/bin/env bash
# ShipGate pre-commit hook
# Install: cp hooks/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#
# Runs a fast gate check on staged ISL spec files only.
# Fails the commit if any FAIL verdict is produced.

set -e

PRESET=${SHIPGATE_PRESET:-baseline}
THRESHOLD=${SHIPGATE_THRESHOLD:-90}

# Find staged .isl spec files
STAGED_SPECS=$(git diff --cached --name-only --diff-filter=ACM | grep '\.isl$' || true)

if [ -z "$STAGED_SPECS" ]; then
  exit 0
fi

echo "ShipGate: checking staged specs..."

for spec in $STAGED_SPECS; do
  if [ -f "$spec" ]; then
    RESULT=$(shipgate gate "$spec" --impl src --threshold "$THRESHOLD" --format json 2>/dev/null || echo '{"verdict":"FAIL"}')
    VERDICT=$(echo "$RESULT" | grep -o '"verdict":"[^"]*"' | cut -d'"' -f4)
    SCORE=$(echo "$RESULT" | grep -o '"score":[0-9]*' | cut -d':' -f2)

    if [ "$VERDICT" = "FAIL" ]; then
      echo ""
      echo "  ✗  ShipGate: NO-SHIP on $spec (score: ${SCORE:-0}/100)"
      echo "     Run: shipgate gate $spec --impl src --threshold $THRESHOLD"
      echo "     to see full findings before committing."
      echo ""
      exit 1
    else
      echo "  ✓  $spec — $VERDICT (score: ${SCORE:-?}/100)"
    fi
  fi
done

echo "ShipGate: all staged specs passed."
