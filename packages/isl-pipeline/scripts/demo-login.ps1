# ISL Pipeline Demo: stdlib-auth Login
# PowerShell script for Windows
#
# Usage:
#   .\scripts\demo-login.ps1           # Run the full demo
#   .\scripts\demo-login.ps1 -failure  # Run the failure mode demo
#
# Prerequisites:
#   - Node.js 18+
#   - pnpm installed
#   - Dependencies installed (pnpm install)

param(
    [switch]$failure,
    [switch]$help
)

$ErrorActionPreference = "Stop"

# Colors for output
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Cyan }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }

function Show-Banner {
    Write-Host ""
    Write-Info "╔══════════════════════════════════════════════════════════════════════╗"
    Write-Info "║                                                                      ║"
    Write-Info "║   ISL Pipeline Demo: stdlib-auth Login                               ║"
    Write-Info "║                                                                      ║"
    Write-Info "║   Demonstrates the core ISL promise:                                 ║"
    Write-Info "║   Import → Generate → Verify → Proof Bundle → PROVEN                 ║"
    Write-Info "║                                                                      ║"
    Write-Info "╚══════════════════════════════════════════════════════════════════════╝"
    Write-Host ""
}

function Show-Help {
    Write-Host ""
    Write-Host "ISL Pipeline Demo: stdlib-auth Login"
    Write-Host ""
    Write-Host "USAGE:"
    Write-Host "  .\scripts\demo-login.ps1           Run the full success demo"
    Write-Host "  .\scripts\demo-login.ps1 -failure  Run the failure mode demo"
    Write-Host "  .\scripts\demo-login.ps1 -help     Show this help"
    Write-Host ""
    Write-Host "DEMOS:"
    Write-Host "  Success Demo:"
    Write-Host "    1. Import stdlib-auth login.isl"
    Write-Host "    2. Generate code + tests"
    Write-Host "    3. Run verification (real expression evaluation)"
    Write-Host "    4. Produce proof bundle"
    Write-Host "    5. Proof verify => PROVEN"
    Write-Host ""
    Write-Host "  Failure Mode Demo:"
    Write-Host "    1. Start with broken implementation"
    Write-Host "    2. Run gate => NO_SHIP with violations"
    Write-Host "    3. Healer generates patches"
    Write-Host "    4. Apply patches"
    Write-Host "    5. Re-run gate => SHIP"
    Write-Host ""
    Write-Host "OUTPUT:"
    Write-Host "  Output files are saved to packages/isl-pipeline/demo-login/output/"
    Write-Host ""
}

function Check-Prerequisites {
    Write-Info "Checking prerequisites..."
    
    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-Success "  ✓ Node.js $nodeVersion"
    } catch {
        Write-Error "  ✗ Node.js not found. Please install Node.js 18+"
        exit 1
    }
    
    # Check pnpm
    try {
        $pnpmVersion = pnpm --version
        Write-Success "  ✓ pnpm $pnpmVersion"
    } catch {
        Write-Error "  ✗ pnpm not found. Install with: npm install -g pnpm"
        exit 1
    }
    
    # Check tsx
    try {
        $tsxCheck = pnpm exec tsx --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Success "  ✓ tsx available"
        } else {
            throw "tsx not available"
        }
    } catch {
        Write-Warning "  ⚠ tsx not found, will attempt to run anyway"
    }
    
    Write-Host ""
}

function Run-Demo {
    param([string]$scriptPath, [string]$demoName)
    
    Write-Info "Running $demoName..."
    Write-Host ""
    
    $startTime = Get-Date
    
    try {
        # Run from the isl-pipeline package directory
        $pipelineDir = Join-Path $PSScriptRoot ".."
        Push-Location $pipelineDir
        
        # Execute the demo script
        pnpm exec tsx $scriptPath
        $exitCode = $LASTEXITCODE
        
        Pop-Location
        
        $duration = (Get-Date) - $startTime
        
        Write-Host ""
        Write-Info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        
        if ($exitCode -eq 0) {
            Write-Success "Demo completed successfully in $($duration.TotalSeconds.ToString('F2'))s"
            Write-Host ""
            Write-Info "Output saved to: packages/isl-pipeline/demo-login/output/"
            Write-Host ""
            return $true
        } else {
            Write-Error "Demo failed with exit code $exitCode"
            return $false
        }
    } catch {
        Pop-Location
        Write-Error "Demo execution failed: $_"
        return $false
    }
}

# Main execution
if ($help) {
    Show-Help
    exit 0
}

Show-Banner
Check-Prerequisites

if ($failure) {
    Write-Warning "Running FAILURE MODE demo..."
    Write-Warning "This demonstrates: Break Clause → VIOLATED → Healer Patches → PROVEN"
    Write-Host ""
    
    $success = Run-Demo "demo-login/failure-mode.ts" "Failure Mode Demo"
} else {
    Write-Info "Running SUCCESS demo..."
    Write-Info "This demonstrates: Import → Generate → Verify → Proof Bundle → PROVEN"
    Write-Host ""
    
    $success = Run-Demo "demo-login/run.ts" "Success Demo"
}

if ($success) {
    Write-Host ""
    Write-Success "╔══════════════════════════════════════════════════════════════════════╗"
    Write-Success "║  Demo completed! The ISL Pipeline has demonstrated provable code.    ║"
    Write-Success "╚══════════════════════════════════════════════════════════════════════╝"
    Write-Host ""
    exit 0
} else {
    Write-Host ""
    Write-Error "Demo failed. Check the output above for errors."
    Write-Host ""
    exit 1
}
