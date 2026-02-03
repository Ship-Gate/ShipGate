#!/usr/bin/env pwsh
<#
.SYNOPSIS
    ISL 1.0.0 Release Verification Script
.DESCRIPTION
    Runs full gate checks for the ISL 1.0 release candidate.
    Executes: install → build → test → typecheck → gate check
.EXAMPLE
    .\scripts\release-verify.ps1
.EXAMPLE
    .\scripts\release-verify.ps1 -Verbose
.NOTES
    Exit codes:
    0 - All checks passed (PASS)
    1 - One or more checks failed (FAIL)
#>

[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$SkipBuild,
    [switch]$SkipTests,
    [switch]$SkipTypecheck,
    [switch]$SkipGate,
    [switch]$Quick
)

$ErrorActionPreference = "Stop"
$script:StartTime = Get-Date
$script:ChecksPassed = 0
$script:ChecksFailed = 0
$script:Results = @()

# Colors and formatting
function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
}

function Write-Step {
    param([int]$Step, [int]$Total, [string]$Name, [string]$Status = "...")
    $statusColor = switch ($Status) {
        "..." { "Yellow" }
        "PASS" { "Green" }
        "FAIL" { "Red" }
        "SKIP" { "DarkGray" }
        default { "White" }
    }
    $icon = switch ($Status) {
        "PASS" { "✓" }
        "FAIL" { "✗" }
        "SKIP" { "○" }
        default { "…" }
    }
    Write-Host "[$Step/$Total] $Name".PadRight(35) -NoNewline
    Write-Host "$icon $Status" -ForegroundColor $statusColor
}

function Write-Result {
    param([bool]$Passed)
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $(if ($Passed) { "Green" } else { "Red" })
    if ($Passed) {
        Write-Host "  RESULT: PASS" -ForegroundColor Green
        Write-Host "  All gate checks passed successfully." -ForegroundColor Green
        Write-Host ""
        Write-Host "  Verified by VibeCheck ✓" -ForegroundColor Green
    } else {
        Write-Host "  RESULT: FAIL" -ForegroundColor Red
        Write-Host "  $script:ChecksFailed check(s) failed." -ForegroundColor Red
        Write-Host ""
        Write-Host "  Fix the failing checks and re-run." -ForegroundColor Yellow
    }
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor $(if ($Passed) { "Green" } else { "Red" })
    Write-Host ""
}

function Add-Result {
    param([string]$Check, [bool]$Passed, [string]$Details = "")
    $script:Results += [PSCustomObject]@{
        Check = $Check
        Passed = $Passed
        Details = $Details
    }
    if ($Passed) {
        $script:ChecksPassed++
    } else {
        $script:ChecksFailed++
    }
}

function Test-Command {
    param([string]$Command)
    try {
        $null = Get-Command $Command -ErrorAction Stop
        return $true
    } catch {
        return $false
    }
}

# Main execution
Write-Header "ISL 1.0.0 Release Verification"

$totalSteps = 5
if ($Quick) {
    $SkipTests = $true
    $SkipTypecheck = $true
    $totalSteps = 3
}

# Determine package manager
$pm = if (Test-Command "pnpm") { "pnpm" } elseif (Test-Command "npm") { "npm" } else { $null }

if (-not $pm) {
    Write-Host "ERROR: No package manager found. Install pnpm or npm." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "  Package manager: $pm" -ForegroundColor Gray
Write-Host "  Working directory: $(Get-Location)" -ForegroundColor Gray
Write-Host ""

$currentStep = 0

# Step 1: Install dependencies
$currentStep++
if (-not $SkipInstall) {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Installing dependencies"
    try {
        $installOutput = & $pm install 2>&1
        $installSuccess = $LASTEXITCODE -eq 0
        if ($installSuccess) {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Installing dependencies" -Status "PASS"
            Add-Result -Check "Install" -Passed $true
        } else {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Installing dependencies" -Status "FAIL"
            Add-Result -Check "Install" -Passed $false -Details ($installOutput -join "`n")
        }
    } catch {
        Write-Step -Step $currentStep -Total $totalSteps -Name "Installing dependencies" -Status "FAIL"
        Add-Result -Check "Install" -Passed $false -Details $_.Exception.Message
    }
} else {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Installing dependencies" -Status "SKIP"
    Add-Result -Check "Install" -Passed $true -Details "Skipped"
}

# Step 2: Build
$currentStep++
if (-not $SkipBuild) {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Building packages"
    try {
        $buildOutput = & $pm run build 2>&1
        $buildSuccess = $LASTEXITCODE -eq 0
        if ($buildSuccess) {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Building packages" -Status "PASS"
            Add-Result -Check "Build" -Passed $true
        } else {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Building packages" -Status "FAIL"
            Add-Result -Check "Build" -Passed $false -Details ($buildOutput -join "`n")
        }
    } catch {
        Write-Step -Step $currentStep -Total $totalSteps -Name "Building packages" -Status "FAIL"
        Add-Result -Check "Build" -Passed $false -Details $_.Exception.Message
    }
} else {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Building packages" -Status "SKIP"
    Add-Result -Check "Build" -Passed $true -Details "Skipped"
}

# Step 3: Tests
$currentStep++
if (-not $SkipTests) {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Running tests"
    try {
        $testOutput = & $pm run test 2>&1
        $testSuccess = $LASTEXITCODE -eq 0
        if ($testSuccess) {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Running tests" -Status "PASS"
            Add-Result -Check "Tests" -Passed $true
        } else {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Running tests" -Status "FAIL"
            Add-Result -Check "Tests" -Passed $false -Details ($testOutput -join "`n")
        }
    } catch {
        Write-Step -Step $currentStep -Total $totalSteps -Name "Running tests" -Status "FAIL"
        Add-Result -Check "Tests" -Passed $false -Details $_.Exception.Message
    }
} else {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Running tests" -Status "SKIP"
    Add-Result -Check "Tests" -Passed $true -Details "Skipped"
}

# Step 4: Typecheck
$currentStep++
if (-not $SkipTypecheck) {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Running typecheck"
    try {
        $typecheckOutput = & $pm run typecheck 2>&1
        $typecheckSuccess = $LASTEXITCODE -eq 0
        if ($typecheckSuccess) {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Running typecheck" -Status "PASS"
            Add-Result -Check "Typecheck" -Passed $true
        } else {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Running typecheck" -Status "FAIL"
            Add-Result -Check "Typecheck" -Passed $false -Details ($typecheckOutput -join "`n")
        }
    } catch {
        Write-Step -Step $currentStep -Total $totalSteps -Name "Running typecheck" -Status "FAIL"
        Add-Result -Check "Typecheck" -Passed $false -Details $_.Exception.Message
    }
} else {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Running typecheck" -Status "SKIP"
    Add-Result -Check "Typecheck" -Passed $true -Details "Skipped"
}

# Step 5: Gate check (verify critical packages)
$currentStep++
if (-not $SkipGate) {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Running gate check"
    try {
        # Run critical tests only for gate check
        $gateOutput = & $pm run test:critical 2>&1
        $gateSuccess = $LASTEXITCODE -eq 0
        if ($gateSuccess) {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Running gate check" -Status "PASS"
            Add-Result -Check "Gate" -Passed $true
        } else {
            Write-Step -Step $currentStep -Total $totalSteps -Name "Running gate check" -Status "FAIL"
            Add-Result -Check "Gate" -Passed $false -Details ($gateOutput -join "`n")
        }
    } catch {
        Write-Step -Step $currentStep -Total $totalSteps -Name "Running gate check" -Status "FAIL"
        Add-Result -Check "Gate" -Passed $false -Details $_.Exception.Message
    }
} else {
    Write-Step -Step $currentStep -Total $totalSteps -Name "Running gate check" -Status "SKIP"
    Add-Result -Check "Gate" -Passed $true -Details "Skipped"
}

# Calculate elapsed time
$elapsed = (Get-Date) - $script:StartTime
$elapsedStr = "{0:mm\:ss}" -f $elapsed

# Print summary
$allPassed = $script:ChecksFailed -eq 0
Write-Result -Passed $allPassed

# Print timing
Write-Host "  Completed in $elapsedStr" -ForegroundColor Gray
Write-Host ""

# Print detailed results if verbose or if there were failures
if ($VerbosePreference -eq "Continue" -or -not $allPassed) {
    Write-Host "  Detailed Results:" -ForegroundColor Gray
    foreach ($result in $script:Results) {
        $icon = if ($result.Passed) { "✓" } else { "✗" }
        $color = if ($result.Passed) { "Green" } else { "Red" }
        Write-Host "    $icon $($result.Check)" -ForegroundColor $color
        if (-not $result.Passed -and $result.Details) {
            Write-Host "      $($result.Details.Substring(0, [Math]::Min(200, $result.Details.Length)))..." -ForegroundColor DarkGray
        }
    }
    Write-Host ""
}

# Exit with appropriate code
exit $(if ($allPassed) { 0 } else { 1 })
