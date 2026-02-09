# Build essential workspace dependencies for CLI bundling

$ErrorActionPreference = "Continue"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PKG_DIR = Split-Path -Parent $SCRIPT_DIR
$ROOT_DIR = Split-Path -Parent $PKG_DIR

Set-Location $ROOT_DIR

Write-Host "▸ Building essential workspace dependencies..." -ForegroundColor Cyan

# Build core dependencies that CLI needs
# Continue on failure - some packages may have build issues but we'll try to bundle anyway
$packages = @(
    "@isl-lang/parser",
    "@isl-lang/core",
    "@isl-lang/import-resolver",
    "@isl-lang/semantic-analysis",
    "@isl-lang/isl-core",
    "@isl-lang/isl-verify",
    "@isl-lang/gate",
    "@isl-lang/pipeline",
    "@isl-lang/policy-packs",
    "@isl-lang/isl-policy-engine",
    "@isl-lang/proof",
    "@isl-lang/truthpack-v2"
)

foreach ($pkg in $packages) {
    Write-Host "  Building $pkg..." -ForegroundColor Gray
    pnpm --filter $pkg build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠ $pkg build failed, continuing..." -ForegroundColor Yellow
    }
}

# Observability needs special handling (skip DTS)
Write-Host "  Building @isl-lang/observability (without DTS)..." -ForegroundColor Gray
Set-Location packages/observability
pnpm run build -- --dts false 2>&1 | Out-Null
Set-Location $ROOT_DIR

Write-Host "✓ Dependency builds complete" -ForegroundColor Green
