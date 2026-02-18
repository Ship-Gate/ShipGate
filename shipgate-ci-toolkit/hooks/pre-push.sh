#!/usr/bin/env bash
# ShipGate pre-push hook
# Install: cp hooks/pre-push.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push
#
# Runs the full gate against all specs before any push to protected branches.
# Fails the push if verdict is FAIL.

set -e

PRESET=${SHIPGATE_PRESET:-strict}
THRESHOLD=${SHIPGATE_THRESHOLD:-95}
PROTECTED_BRANCHES="main master release"
SPECS_DIR=${SHIPGATE_SPECS:-specs}
IMPL_DIR=${SHIPGATE_IMPL:-src}

# Determine target branch
while read local_ref local_sha remote_ref remote_sha; do
  BRANCH=$(echo "$remote_ref" | sed 's|refs/heads/||')

  # Only gate on protected branches
  IS_PROTECTED=false
  for b in $PROTECTED_BRANCHES; do
    if [ "$BRANCH" = "$b" ]; then IS_PROTECTED=true; fi
  done

  if [ "$IS_PROTECTED" = "false" ]; then
    exit 0
  fi

  echo ""
  echo "ShipGate: running full gate before push to $BRANCH..."
  echo ""

  REPORT_DIR=$(mktemp -d)
  RESULT=$(shipgate gate "$SPECS_DIR" \
    --impl "$IMPL_DIR" \
    --threshold "$THRESHOLD" \
    --output "$REPORT_DIR" \
    --ci 2>&1) || true

  if [ -f "$REPORT_DIR/report.json" ]; then
    VERDICT=$(jq -r '.verdict' "$REPORT_DIR/report.json" 2>/dev/null || echo "FAIL")
    SCORE=$(jq -r '.score' "$REPORT_DIR/report.json" 2>/dev/null || echo "0")
    BLOCKERS=$(jq -r '.summary.blockerCount' "$REPORT_DIR/report.json" 2>/dev/null || echo "?")
  else
    VERDICT="FAIL"
    SCORE=0
    BLOCKERS="?"
  fi

  echo "  Verdict:  $VERDICT"
  echo "  Score:    $SCORE / 100"
  echo "  Blockers: $BLOCKERS"
  echo ""

  if [ "$VERDICT" = "FAIL" ]; then
    echo "  ✗  ShipGate blocked push to $BRANCH."
    echo "     Fix the blockers and try again."
    echo "     Report: $REPORT_DIR/report.json"
    echo ""
    exit 1
  fi

  echo "  ✓  ShipGate: PASS — push allowed."
  echo ""
done

exit 0
