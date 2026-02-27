#!/bin/bash
# Smoke tests for Shipgate CLI
# Tests that npx shipgate works correctly after publishing

set -e

echo "🧪 Running Shipgate CLI smoke tests..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Test function
test_command() {
    local name="$1"
    local command="$2"
    local expected_exit="${3:-0}"
    
    echo -n "Testing: $name... "
    
    if eval "$command" > /dev/null 2>&1; then
        EXIT_CODE=$?
    else
        EXIT_CODE=$?
    fi
    
    if [ "$EXIT_CODE" -eq "$expected_exit" ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED (exit code: $EXIT_CODE, expected: $expected_exit)${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Test 1: --help
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: shipgate --help"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_command "shipgate --help" "npx shipgate --help" 0

# Test 2: --version
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: shipgate --version"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
VERSION_OUTPUT=$(npx shipgate --version 2>&1 || true)
if echo "$VERSION_OUTPUT" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
    echo -e "${GREEN}✓ PASSED${NC} (version: $VERSION_OUTPUT)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAILED${NC} (output: $VERSION_OUTPUT)"
    FAILED=$((FAILED + 1))
fi

# Test 3: init --help
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 3: shipgate init --help"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_command "shipgate init --help" "npx shipgate init --help" 0

# Test 4: init (non-interactive)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 4: shipgate init (creates minimal project)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TEST_DIR=$(mktemp -d)
cd "$TEST_DIR" || exit 1

# Run init non-interactively (should create files in current directory)
if npx shipgate init --template minimal > /dev/null 2>&1; then
    # Check for expected files
    if [ -f "package.json" ] && [ -f "isl.config.json" ]; then
        # Check for ISL file in src/
        if [ -f "src"/*.isl ] 2>/dev/null || find src -name "*.isl" -type f | grep -q .; then
            echo -e "${GREEN}✓ PASSED${NC} (project structure created)"
            PASSED=$((PASSED + 1))
        else
            echo -e "${RED}✗ FAILED${NC} (ISL file not found)"
            FAILED=$((FAILED + 1))
        fi
    else
        echo -e "${RED}✗ FAILED${NC} (expected files not created)"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${RED}✗ FAILED${NC} (init command failed)"
    FAILED=$((FAILED + 1))
fi

# Cleanup
cd - > /dev/null || true
rm -rf "$TEST_DIR"

# Test 5: parse --help
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 5: shipgate parse --help"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_command "shipgate parse --help" "npx shipgate parse --help" 0

# Test 6: parse with non-existent file (should fail gracefully)
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 6: shipgate parse (non-existent file)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_command "shipgate parse non-existent.isl" "npx shipgate parse ./nonexistent.isl" 1

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed: $PASSED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
    exit 1
else
    echo -e "${GREEN}Failed: $FAILED${NC}"
    echo ""
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    exit 0
fi
