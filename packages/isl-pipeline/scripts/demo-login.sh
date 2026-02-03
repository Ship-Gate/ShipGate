#!/bin/bash
# ISL Pipeline Demo: stdlib-auth Login
# Bash script for Linux/macOS
#
# Usage:
#   ./scripts/demo-login.sh           # Run the full demo
#   ./scripts/demo-login.sh --failure # Run the failure mode demo
#
# Prerequisites:
#   - Node.js 18+
#   - pnpm installed
#   - Dependencies installed (pnpm install)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIPELINE_DIR="$(dirname "$SCRIPT_DIR")"

show_banner() {
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                                                                      ║${NC}"
    echo -e "${CYAN}║   ISL Pipeline Demo: stdlib-auth Login                               ║${NC}"
    echo -e "${CYAN}║                                                                      ║${NC}"
    echo -e "${CYAN}║   Demonstrates the core ISL promise:                                 ║${NC}"
    echo -e "${CYAN}║   Import → Generate → Verify → Proof Bundle → PROVEN                 ║${NC}"
    echo -e "${CYAN}║                                                                      ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

show_help() {
    echo ""
    echo "ISL Pipeline Demo: stdlib-auth Login"
    echo ""
    echo "USAGE:"
    echo "  ./scripts/demo-login.sh           Run the full success demo"
    echo "  ./scripts/demo-login.sh --failure Run the failure mode demo"
    echo "  ./scripts/demo-login.sh --help    Show this help"
    echo ""
    echo "DEMOS:"
    echo "  Success Demo:"
    echo "    1. Import stdlib-auth login.isl"
    echo "    2. Generate code + tests"
    echo "    3. Run verification (real expression evaluation)"
    echo "    4. Produce proof bundle"
    echo "    5. Proof verify => PROVEN"
    echo ""
    echo "  Failure Mode Demo:"
    echo "    1. Start with broken implementation"
    echo "    2. Run gate => NO_SHIP with violations"
    echo "    3. Healer generates patches"
    echo "    4. Apply patches"
    echo "    5. Re-run gate => SHIP"
    echo ""
    echo "OUTPUT:"
    echo "  Output files are saved to packages/isl-pipeline/demo-login/output/"
    echo ""
}

check_prerequisites() {
    echo -e "${CYAN}Checking prerequisites...${NC}"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        echo -e "${GREEN}  ✓ Node.js $NODE_VERSION${NC}"
    else
        echo -e "${RED}  ✗ Node.js not found. Please install Node.js 18+${NC}"
        exit 1
    fi
    
    # Check pnpm
    if command -v pnpm &> /dev/null; then
        PNPM_VERSION=$(pnpm --version)
        echo -e "${GREEN}  ✓ pnpm $PNPM_VERSION${NC}"
    else
        echo -e "${RED}  ✗ pnpm not found. Install with: npm install -g pnpm${NC}"
        exit 1
    fi
    
    # Check tsx
    if pnpm exec tsx --version &> /dev/null; then
        echo -e "${GREEN}  ✓ tsx available${NC}"
    else
        echo -e "${YELLOW}  ⚠ tsx not found, will attempt to run anyway${NC}"
    fi
    
    echo ""
}

run_demo() {
    local script_path=$1
    local demo_name=$2
    
    echo -e "${CYAN}Running $demo_name...${NC}"
    echo ""
    
    local start_time=$(date +%s)
    
    # Run from the isl-pipeline package directory
    cd "$PIPELINE_DIR"
    
    # Execute the demo script
    if pnpm exec tsx "$script_path"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo ""
        echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}Demo completed successfully in ${duration}s${NC}"
        echo ""
        echo -e "${CYAN}Output saved to: packages/isl-pipeline/demo-login/output/${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}Demo failed${NC}"
        return 1
    fi
}

# Parse arguments
FAILURE_MODE=false

for arg in "$@"; do
    case $arg in
        --failure|-f)
            FAILURE_MODE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown argument: $arg${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
show_banner
check_prerequisites

if [ "$FAILURE_MODE" = true ]; then
    echo -e "${YELLOW}Running FAILURE MODE demo...${NC}"
    echo -e "${YELLOW}This demonstrates: Break Clause → VIOLATED → Healer Patches → PROVEN${NC}"
    echo ""
    
    if run_demo "demo-login/failure-mode.ts" "Failure Mode Demo"; then
        SUCCESS=true
    else
        SUCCESS=false
    fi
else
    echo -e "${CYAN}Running SUCCESS demo...${NC}"
    echo -e "${CYAN}This demonstrates: Import → Generate → Verify → Proof Bundle → PROVEN${NC}"
    echo ""
    
    if run_demo "demo-login/run.ts" "Success Demo"; then
        SUCCESS=true
    else
        SUCCESS=false
    fi
fi

if [ "$SUCCESS" = true ]; then
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Demo completed! The ISL Pipeline has demonstrated provable code.    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    exit 0
else
    echo ""
    echo -e "${RED}Demo failed. Check the output above for errors.${NC}"
    echo ""
    exit 1
fi
