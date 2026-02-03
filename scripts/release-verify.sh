#!/usr/bin/env bash
#
# ISL 1.0.0 Release Verification Script
#
# Runs full gate checks for the ISL 1.0 release candidate.
# Executes: install → build → test → typecheck → gate check
#
# Usage:
#   ./scripts/release-verify.sh
#   ./scripts/release-verify.sh --quick
#   ./scripts/release-verify.sh --skip-tests
#
# Exit codes:
#   0 - All checks passed (PASS)
#   1 - One or more checks failed (FAIL)

set -e

# Configuration
SKIP_INSTALL=false
SKIP_BUILD=false
SKIP_TESTS=false
SKIP_TYPECHECK=false
SKIP_GATE=false
QUICK=false
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-install) SKIP_INSTALL=true; shift ;;
        --skip-build) SKIP_BUILD=true; shift ;;
        --skip-tests) SKIP_TESTS=true; shift ;;
        --skip-typecheck) SKIP_TYPECHECK=true; shift ;;
        --skip-gate) SKIP_GATE=true; shift ;;
        --quick) QUICK=true; SKIP_TESTS=true; SKIP_TYPECHECK=true; shift ;;
        --verbose|-v) VERBOSE=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# State
CHECKS_PASSED=0
CHECKS_FAILED=0
START_TIME=$(date +%s)

# Functions
write_header() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

write_step() {
    local step=$1
    local total=$2
    local name=$3
    local status=${4:-"..."}
    
    local color=""
    local icon=""
    case $status in
        "PASS") color="${GREEN}"; icon="✓" ;;
        "FAIL") color="${RED}"; icon="✗" ;;
        "SKIP") color="${GRAY}"; icon="○" ;;
        *) color="${YELLOW}"; icon="…" ;;
    esac
    
    printf "[%d/%d] %-30s %b%s %s%b\n" "$step" "$total" "$name" "$color" "$icon" "$status" "${NC}"
}

write_result() {
    local passed=$1
    
    echo ""
    if [ "$passed" = true ]; then
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  RESULT: PASS${NC}"
        echo -e "${GREEN}  All gate checks passed successfully.${NC}"
        echo ""
        echo -e "${GREEN}  Verified by VibeCheck ✓${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    else
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  RESULT: FAIL${NC}"
        echo -e "${RED}  $CHECKS_FAILED check(s) failed.${NC}"
        echo ""
        echo -e "${YELLOW}  Fix the failing checks and re-run.${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    fi
    echo ""
}

# Determine package manager
if command -v pnpm &> /dev/null; then
    PM="pnpm"
elif command -v npm &> /dev/null; then
    PM="npm"
else
    echo -e "${RED}ERROR: No package manager found. Install pnpm or npm.${NC}"
    exit 1
fi

# Main execution
write_header "ISL 1.0.0 Release Verification"

TOTAL_STEPS=5
if [ "$QUICK" = true ]; then
    TOTAL_STEPS=3
fi

echo ""
echo -e "${GRAY}  Package manager: $PM${NC}"
echo -e "${GRAY}  Working directory: $(pwd)${NC}"
echo ""

CURRENT_STEP=0

# Step 1: Install dependencies
CURRENT_STEP=$((CURRENT_STEP + 1))
if [ "$SKIP_INSTALL" = false ]; then
    write_step $CURRENT_STEP $TOTAL_STEPS "Installing dependencies"
    if $PM install > /tmp/install.log 2>&1; then
        write_step $CURRENT_STEP $TOTAL_STEPS "Installing dependencies" "PASS"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        write_step $CURRENT_STEP $TOTAL_STEPS "Installing dependencies" "FAIL"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        [ "$VERBOSE" = true ] && cat /tmp/install.log
    fi
else
    write_step $CURRENT_STEP $TOTAL_STEPS "Installing dependencies" "SKIP"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
fi

# Step 2: Build
CURRENT_STEP=$((CURRENT_STEP + 1))
if [ "$SKIP_BUILD" = false ]; then
    write_step $CURRENT_STEP $TOTAL_STEPS "Building packages"
    if $PM run build > /tmp/build.log 2>&1; then
        write_step $CURRENT_STEP $TOTAL_STEPS "Building packages" "PASS"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        write_step $CURRENT_STEP $TOTAL_STEPS "Building packages" "FAIL"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        [ "$VERBOSE" = true ] && cat /tmp/build.log
    fi
else
    write_step $CURRENT_STEP $TOTAL_STEPS "Building packages" "SKIP"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
fi

# Step 3: Tests
CURRENT_STEP=$((CURRENT_STEP + 1))
if [ "$SKIP_TESTS" = false ]; then
    write_step $CURRENT_STEP $TOTAL_STEPS "Running tests"
    if $PM run test > /tmp/test.log 2>&1; then
        write_step $CURRENT_STEP $TOTAL_STEPS "Running tests" "PASS"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        write_step $CURRENT_STEP $TOTAL_STEPS "Running tests" "FAIL"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        [ "$VERBOSE" = true ] && cat /tmp/test.log
    fi
else
    write_step $CURRENT_STEP $TOTAL_STEPS "Running tests" "SKIP"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
fi

# Step 4: Typecheck
CURRENT_STEP=$((CURRENT_STEP + 1))
if [ "$SKIP_TYPECHECK" = false ]; then
    write_step $CURRENT_STEP $TOTAL_STEPS "Running typecheck"
    if $PM run typecheck > /tmp/typecheck.log 2>&1; then
        write_step $CURRENT_STEP $TOTAL_STEPS "Running typecheck" "PASS"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        write_step $CURRENT_STEP $TOTAL_STEPS "Running typecheck" "FAIL"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        [ "$VERBOSE" = true ] && cat /tmp/typecheck.log
    fi
else
    write_step $CURRENT_STEP $TOTAL_STEPS "Running typecheck" "SKIP"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
fi

# Step 5: Gate check
CURRENT_STEP=$((CURRENT_STEP + 1))
if [ "$SKIP_GATE" = false ]; then
    write_step $CURRENT_STEP $TOTAL_STEPS "Running gate check"
    if $PM run test:critical > /tmp/gate.log 2>&1; then
        write_step $CURRENT_STEP $TOTAL_STEPS "Running gate check" "PASS"
        CHECKS_PASSED=$((CHECKS_PASSED + 1))
    else
        write_step $CURRENT_STEP $TOTAL_STEPS "Running gate check" "FAIL"
        CHECKS_FAILED=$((CHECKS_FAILED + 1))
        [ "$VERBOSE" = true ] && cat /tmp/gate.log
    fi
else
    write_step $CURRENT_STEP $TOTAL_STEPS "Running gate check" "SKIP"
    CHECKS_PASSED=$((CHECKS_PASSED + 1))
fi

# Calculate elapsed time
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
ELAPSED_MIN=$((ELAPSED / 60))
ELAPSED_SEC=$((ELAPSED % 60))

# Print summary
ALL_PASSED=true
if [ $CHECKS_FAILED -gt 0 ]; then
    ALL_PASSED=false
fi

write_result $ALL_PASSED

printf "${GRAY}  Completed in %02d:%02d${NC}\n" $ELAPSED_MIN $ELAPSED_SEC
echo ""

# Exit with appropriate code
if [ "$ALL_PASSED" = true ]; then
    exit 0
else
    exit 1
fi
