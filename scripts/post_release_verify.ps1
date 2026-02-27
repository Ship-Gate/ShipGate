# Post-Release Verification Script (Shipgate 1.0)
#
# Validates installs and integrations after release:
#   - Installs CLI globally (npm)
#   - Runs shipgate --version (global)
#   - Runs shipgate init (global or npx, in temp dir)
#   - Runs npx shipgate --version
#   - Captures all output to artifacts/post_release/
#
# Usage:
#   .\scripts\post_release_verify.ps1
#   .\scripts\post_release_verify.ps1 -Version 1.0.0
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed (see logs in artifacts/post_release/)

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$Version = ""
)

$ErrorActionPreference = "Stop"
$script:Failed = 0
$script:RepoRoot = $PSScriptRoot | Split-Path -Parent
$script:ArtifactDir = Join-Path $script:RepoRoot "artifacts" "post_release"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$script:LogPrefix = Join-Path $script:ArtifactDir "post_release_verify_$timestamp"

function Ensure-ArtifactDir {
    if (-not (Test-Path $script:ArtifactDir)) {
        New-Item -ItemType Directory -Path $script:ArtifactDir -Force | Out-Null
    }
}

function Write-Step {
    param([string]$Name, [string]$Status, [string]$Detail = "")
    $color = if ($Status -eq "PASS") { "Green" } elseif ($Status -eq "FAIL") { "Red" } else { "Yellow" }
    Write-Host "[verify] $Name" -ForegroundColor Cyan
    Write-Host "  $Status" -ForegroundColor $color
    if ($Detail) { Write-Host "  $Detail" -ForegroundColor Gray }
}

function Run-Step {
    param([string]$Name, [scriptblock]$Command)
    $logFile = "${script:LogPrefix}_${Name}.log"
    Write-Host "[verify] $Name" -ForegroundColor Cyan
    try {
        $out = & $Command 2>&1
        $out | Set-Content -Path $logFile -Encoding utf8
        if ($LASTEXITCODE -eq 0 -or $null -eq $LASTEXITCODE) {
            Write-Host "  PASS (log: $logFile)" -ForegroundColor Green
            return $true
        }
    } catch {
        $_.Exception.Message | Set-Content -Path $logFile -Encoding utf8
    }
    Write-Host "  FAIL (log: $logFile)" -ForegroundColor Red
    $script:Failed++
    return $false
}

Ensure-ArtifactDir

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Post-Release Verification (Shipgate 1.0)" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Artifacts: $script:ArtifactDir" -ForegroundColor Gray
Write-Host "  Version:   $(if ($Version) { $Version } else { 'latest' })" -ForegroundColor Gray
Write-Host ""

# Step 1: Install CLI globally (optional: may fail without sudo/admin)
$pkg = if ($Version) { "shipgate@$Version" } else { "shipgate" }
$logInstall = "${script:LogPrefix}_install_global.log"
Write-Host "[verify] install_global" -ForegroundColor Cyan
try {
    $out = npm install -g $pkg 2>&1 | Out-String
    $out | Set-Content -Path $logInstall -Encoding utf8
    Write-Host "  PASS (log: $logInstall)" -ForegroundColor Green
} catch {
    $_ | Out-String | Set-Content -Path $logInstall -Encoding utf8
    Write-Host "  SKIP or FAIL (log: $logInstall)" -ForegroundColor Yellow
}

# Step 2: shipgate --version (global)
$shipgateInPath = $null -ne (Get-Command shipgate -ErrorAction SilentlyContinue)
if ($shipgateInPath) {
    Run-Step "version_global" { shipgate --version } | Out-Null
} else {
    Write-Host "[verify] shipgate --version (global) SKIP (shipgate not in PATH)" -ForegroundColor Yellow
}

# Step 3: shipgate init (in temp dir)
$initDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$initCmd = if ($shipgateInPath) { "shipgate" } else { "npx shipgate" }
$initCmd = "$initCmd init verify-project --template minimal"
$initLog = "${script:LogPrefix}_init.log"
Write-Host "[verify] shipgate init (in sandbox)" -ForegroundColor Cyan
$prevDir = Get-Location
try {
    Set-Location $initDir.FullName
    $initOut = Invoke-Expression $initCmd 2>&1 | Out-String
    $initOut | Set-Content -Path $initLog -Encoding utf8
    $hasProject = (Test-Path (Join-Path $initDir.FullName "verify-project" "package.json")) -or
                  (Test-Path (Join-Path $initDir.FullName "verify-project" "isl.config.json")) -or
                  (Test-Path (Join-Path $initDir.FullName "package.json"))
    if ($hasProject) {
        Write-Host "  PASS (log: $initLog)" -ForegroundColor Green
    } else {
        Write-Host "  FAIL (expected project files not found, log: $initLog)" -ForegroundColor Red
        $script:Failed++
    }
} catch {
    $_ | Out-String | Set-Content -Path $initLog -Encoding utf8
    Write-Host "  FAIL (log: $initLog)" -ForegroundColor Red
    $script:Failed++
} finally {
    Set-Location $prevDir
    Remove-Item -Recurse -Force $initDir.FullName -ErrorAction SilentlyContinue
}

# Step 4: npx shipgate --version
Run-Step "version_npx" { npx shipgate --version } | Out-Null

# Summary
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
if ($script:Failed -eq 0) {
    Write-Host "  RESULT: PASS — Post-release verification succeeded." -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    exit 0
} else {
    Write-Host "  RESULT: FAIL — $($script:Failed) check(s) failed. See artifacts/post_release/." -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}
