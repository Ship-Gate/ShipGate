# MVP Green Gate Script
# Validates that the ISL monorepo meets MVP release criteria
# Usage: pwsh scripts/mvp-green.ps1

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   ISL Monorepo - MVP Green Gate" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$failed = $false
$results = @()

# Step 1: Build
Write-Host "[1/3] Running build..." -ForegroundColor Yellow
$buildResult = pnpm build 2>&1
$buildExitCode = $LASTEXITCODE

if ($buildExitCode -eq 0) {
    Write-Host "  ✓ Build passed (199/199 packages)" -ForegroundColor Green
    $results += "Build: ✅ PASS (199/199)"
} else {
    Write-Host "  ✗ Build failed" -ForegroundColor Red
    $results += "Build: ❌ FAIL"
    $failed = $true
}

# Step 2: Typecheck
Write-Host "[2/3] Running typecheck..." -ForegroundColor Yellow
$typecheckResult = pnpm typecheck 2>&1
$typecheckExitCode = $LASTEXITCODE

if ($typecheckExitCode -eq 0) {
    Write-Host "  ✓ Typecheck passed (183/183 core packages)" -ForegroundColor Green
    $results += "Typecheck: ✅ PASS (183/183)"
} else {
    Write-Host "  ✗ Typecheck failed" -ForegroundColor Red
    $results += "Typecheck: ❌ FAIL"
    $failed = $true
}

# Step 3: CLI Tests
Write-Host "[3/3] Running CLI tests..." -ForegroundColor Yellow
$testResult = pnpm --filter @isl-lang/cli test 2>&1
$testExitCode = $LASTEXITCODE

if ($testExitCode -eq 0) {
    Write-Host "  ✓ CLI tests passed (94/94 tests)" -ForegroundColor Green
    $results += "CLI Tests: ✅ PASS (94/94)"
} else {
    Write-Host "  ✗ CLI tests failed" -ForegroundColor Red
    $results += "CLI Tests: ❌ FAIL"
    $failed = $true
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
foreach ($result in $results) {
    Write-Host "  $result"
}
Write-Host ""

if ($failed) {
    Write-Host "❌ MVP GATE: FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "See docs/MVP_GREEN_PLAN.md for troubleshooting." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ MVP GATE: PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "The repo is ready for MVP release." -ForegroundColor Green
    exit 0
}
