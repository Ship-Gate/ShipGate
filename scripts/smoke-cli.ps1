# Smoke tests for Shipgate CLI
# Tests that npx shipgate works correctly after publishing

$ErrorActionPreference = "Stop"

Write-Host "🧪 Running Shipgate CLI smoke tests..." -ForegroundColor Cyan
Write-Host ""

$PASSED = 0
$FAILED = 0

function Test-Command {
    param(
        [string]$Name,
        [string]$Command,
        [int]$ExpectedExit = 0
    )
    
    Write-Host -NoNewline "Testing: $Name... "
    
    try {
        $output = Invoke-Expression $Command 2>&1
        $exitCode = $LASTEXITCODE
        if ($null -eq $exitCode) { $exitCode = 0 }
        
        if ($exitCode -eq $ExpectedExit) {
            Write-Host "✓ PASSED" -ForegroundColor Green
            $script:PASSED++
            return $true
        } else {
            Write-Host "✗ FAILED (exit code: $exitCode, expected: $ExpectedExit)" -ForegroundColor Red
            $script:FAILED++
            return $false
        }
    } catch {
        Write-Host "✗ FAILED (error: $_)" -ForegroundColor Red
        $script:FAILED++
        return $false
    }
}

# Test 1: --help
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Test 1: shipgate --help"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Test-Command "shipgate --help" "npx shipgate --help" 0

# Test 2: --version
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Test 2: shipgate --version"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
try {
    $versionOutput = npx shipgate --version 2>&1 | Out-String
    if ($versionOutput -match '^\d+\.\d+\.\d+$') {
        Write-Host "✓ PASSED (version: $versionOutput)" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "✗ FAILED (output: $versionOutput)" -ForegroundColor Red
        $FAILED++
    }
} catch {
    Write-Host "✗ FAILED (error: $_)" -ForegroundColor Red
    $FAILED++
}

# Test 3: init --help
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Test 3: shipgate init --help"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Test-Command "shipgate init --help" "npx shipgate init --help" 0

# Test 4: init (non-interactive)
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Test 4: shipgate init (creates minimal project)"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$TEST_DIR = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$originalDir = Get-Location

try {
    Set-Location $TEST_DIR.FullName
    
    # Run init non-interactively
    $initOutput = npx shipgate init test-project --template minimal 2>&1 | Out-String
    
    # Check for expected files
    $packageJson = Join-Path $TEST_DIR.FullName "test-project" "package.json"
    $configJson = Join-Path $TEST_DIR.FullName "test-project" "isl.config.json"
    
    if ((Test-Path $packageJson) -and (Test-Path $configJson)) {
        # Check for ISL file in src/
        $islFiles = Get-ChildItem -Path (Join-Path $TEST_DIR.FullName "test-project" "src") -Filter "*.isl" -ErrorAction SilentlyContinue
        if ($islFiles) {
            Write-Host "✓ PASSED (project structure created)" -ForegroundColor Green
            $PASSED++
        } else {
            Write-Host "✗ FAILED (ISL file not found)" -ForegroundColor Red
            $FAILED++
        }
    } else {
        Write-Host "✗ FAILED (expected files not created)" -ForegroundColor Red
        $FAILED++
    }
} catch {
    Write-Host "✗ FAILED (init command failed: $_)" -ForegroundColor Red
    $FAILED++
} finally {
    Set-Location $originalDir
    Remove-Item -Recurse -Force $TEST_DIR.FullName -ErrorAction SilentlyContinue
}

# Test 5: parse --help
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Test 5: shipgate parse --help"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Test-Command "shipgate parse --help" "npx shipgate parse --help" 0

# Test 6: parse with non-existent file (should fail gracefully)
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Test 6: shipgate parse (non-existent file)"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Test-Command "shipgate parse non-existent.isl" "npx shipgate parse .\nonexistent.isl" 1

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Summary"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "Passed: $PASSED" -ForegroundColor Green
if ($FAILED -gt 0) {
    Write-Host "Failed: $FAILED" -ForegroundColor Red
    exit 1
} else {
    Write-Host "Failed: $FAILED" -ForegroundColor Green
    Write-Host ""
    Write-Host "✓ All smoke tests passed!" -ForegroundColor Green
    exit 0
}
