#!/usr/bin/env bash
#
# Post-Release Verification Script (Shipgate 1.0)
#
# Validates installs and integrations after release:
#   - Installs CLI globally (npm)
#   - Runs shipgate --version (global)
#   - Runs shipgate init (global, in temp dir)
#   - Runs npx shipgate --version
#   - Captures all output to artifacts/post_release/
#
# Usage:
#   ./scripts/post_release_verify.sh
#   ./scripts/post_release_verify.sh 1.0.0
#   ./scripts/post_release_verify.sh --version 1.0.0
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed (see logs in artifacts/post_release/)

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ARTIFACT_DIR="$REPO_ROOT/artifacts/post_release"
VERSION="${1:-}"
[ "$1" = "--version" ] && VERSION="${2:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# State
FAILED=0
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_PREFIX="$ARTIFACT_DIR/post_release_verify_${TIMESTAMP}"

mkdir -p "$ARTIFACT_DIR"

run_step() {
    local name="$1"
    local cmd="$2"
    local log_file="${LOG_PREFIX}_${name}.log"
    echo -e "${CYAN}[verify]${NC} $name"
    if eval "$cmd" > "$log_file" 2>&1; then
        echo -e "  ${GREEN}PASS${NC} (log: $log_file)"
        return 0
    else
        echo -e "  ${RED}FAIL${NC} (log: $log_file)"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  Post-Release Verification (Shipgate 1.0)${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "  Artifacts: $ARTIFACT_DIR"
echo "  Version:   ${VERSION:-latest}"
echo ""

# Step 1: Install CLI globally
PKG="shipgate"
[ -n "$VERSION" ] && PKG="shipgate@$VERSION"
run_step "install_global" "npm install -g $PKG" || true
# Allow failure on global install (e.g. no sudo); we still test npx path

# Step 2: shipgate --version (global, only if install succeeded)
if command -v shipgate &>/dev/null; then
    run_step "version_global" "shipgate --version"
else
    echo -e "${YELLOW}[verify] shipgate --version (global) SKIP (shipgate not in PATH)${NC}"
fi

# Step 3: shipgate init (global or npx, in temp dir)
INIT_DIR=$(mktemp -d 2>/dev/null || echo "$ARTIFACT_DIR/init_sandbox_$$")
cleanup_init() { [ -d "$INIT_DIR" ] && [ "$INIT_DIR" != "$ARTIFACT_DIR" ] && rm -rf "$INIT_DIR"; }
trap cleanup_init EXIT

INIT_CMD="shipgate init verify-project --template minimal"
if ! command -v shipgate &>/dev/null; then
    INIT_CMD="npx shipgate init verify-project --template minimal"
fi
echo -e "${CYAN}[verify]${NC} shipgate init (in sandbox)"
INIT_LOG="${LOG_PREFIX}_init.log"
if (cd "$INIT_DIR" && eval "$INIT_CMD" > "$INIT_LOG" 2>&1); then
    if [ -f "$INIT_DIR/verify-project/package.json" ] || [ -f "$INIT_DIR/verify-project/isl.config.json" ] || [ -f "$INIT_DIR/package.json" ]; then
        echo -e "  ${GREEN}PASS${NC} (log: $INIT_LOG)"
    else
        echo -e "  ${RED}FAIL${NC} (expected project files not found, log: $INIT_LOG)"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "  ${RED}FAIL${NC} (log: $INIT_LOG)"
    FAILED=$((FAILED + 1))
fi

# Step 4: npx shipgate --version
run_step "version_npx" "npx shipgate --version"

# Summary
echo ""
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}  RESULT: PASS — Post-release verification succeeded.${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    exit 0
else
    echo -e "${RED}  RESULT: FAIL — $FAILED check(s) failed. See artifacts/post_release/.${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    exit 1
fi
