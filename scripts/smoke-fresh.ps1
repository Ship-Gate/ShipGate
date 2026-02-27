# ShipGate Golden Path Smoke Test (Windows)
# Proves ShipGate works end-to-end on a fresh checkout in <60s.
#
# Usage: pwsh scripts/smoke-fresh.ps1
# Or:    pnpm smoke
#
# FAIL FAST: Prints which step broke and exits immediately.

$ErrorActionPreference = "Stop"

$ROOT = (Get-Item $PSScriptRoot).Parent.FullName
$CLI = Join-Path $ROOT "packages\cli\dist\cli.cjs"
$FIXTURE = Join-Path $ROOT "packages\cli\tests\fixtures\smoke-fresh"
$INIT_DIR = Join-Path $ROOT "packages\cli\tests\fixtures\smoke-init"

function Fail-Step {
    param([string]$StepNum, [string]$StepName, [string]$Cmd, [string]$Output = "")
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  FAIL FAST: Step $StepNum broke" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Step: $StepName"
    Write-Host "  Command: $Cmd"
    if ($Output) {
        Write-Host ""
        Write-Host "  Output:"
        Write-Host "  ---"
        $Output -split "`n" | ForEach-Object { Write-Host "  $_" }
        Write-Host "  ---"
    }
    Write-Host ""
    exit 1
}

function Step {
    param([string]$Num, [string]$Msg)
    Write-Host "[$Num] $Msg" -ForegroundColor Yellow
}

Set-Location $ROOT

# Step 1: Install
Step "1/6" "pnpm install..."
pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { Fail-Step "1" "pnpm install" "pnpm install --frozen-lockfile" "See output above" }
Write-Host "  ✓ install" -ForegroundColor Green

# Step 2: Build
Step "2/6" "pnpm build..."
pnpm build
if ($LASTEXITCODE -ne 0) { Fail-Step "2" "pnpm build" "pnpm build" "See output above" }
Write-Host "  ✓ build" -ForegroundColor Green

# Step 3: CLI --help
Step "3/6" "shipgate --help..."
node $CLI --help
if ($LASTEXITCODE -ne 0) { Fail-Step "3" "shipgate --help" "node $CLI --help" "See output above" }
Write-Host "  ✓ --help" -ForegroundColor Green

# Step 4: init
Step "4/6" "shipgate init..."
if (Test-Path $INIT_DIR) { Remove-Item -Recurse -Force $INIT_DIR }
New-Item -ItemType Directory -Path $INIT_DIR -Force | Out-Null
node $CLI init smoke-init --directory $INIT_DIR
if ($LASTEXITCODE -ne 0) { Fail-Step "4" "shipgate init" "node $CLI init smoke-init --directory $INIT_DIR" "See output above" }
Write-Host "  ✓ init" -ForegroundColor Green

# Step 5: verify
Step "5/6" "shipgate verify..."
node $CLI verify "$FIXTURE\spec.isl" --impl "$FIXTURE\impl.ts"
if ($LASTEXITCODE -ne 0) { Fail-Step "5" "shipgate verify" "node $CLI verify ... --impl ..." "See output above" }
Write-Host "  ✓ verify" -ForegroundColor Green

# Step 6: gate
Step "6/6" "shipgate gate..."
node $CLI gate "$FIXTURE\spec.isl" --impl "$FIXTURE\impl.ts" --threshold 80 --format json
if ($LASTEXITCODE -ne 0) { Fail-Step "6" "shipgate gate" "node $CLI gate ... --impl ... --threshold 80" "See output above" }
Write-Host "  ✓ gate" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ShipGate smoke: PASSED" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
exit 0
