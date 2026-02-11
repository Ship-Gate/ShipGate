# E2E: pack shipgate, install in a temp consumer project, run init / check / gate.
# Run from repo root.
$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Cli = Join-Path $Root packages cli
$Consumer = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_.FullName }
try {
    Write-Host "Building CLI..."
    Set-Location $Cli; pnpm build; Set-Location $Root
    Write-Host "Packing..."
    Set-Location $Cli; npm pack --ignore-scripts 2>&1 | Out-Null; Set-Location $Root
    $Tarball = Get-ChildItem -Path $Cli -Filter "shipgate-*.tgz" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $Tarball) { throw "No tarball found" }
    Write-Host "Installing in consumer dir: $Consumer"
    Set-Location $Consumer
    npm init -y
    npm install ($Tarball.FullName -replace '\\', '/')
    Write-Host "Running shipgate --version..."
    npx shipgate --version
    Write-Host "Running shipgate init..."
    $ProjectDir = Join-Path $Consumer "my-app"
    npx shipgate init my-app --directory $ProjectDir
    $Spec = Join-Path $ProjectDir "src" "my-app.isl"
    if (-not (Test-Path $Spec)) { throw "init did not create spec" }
    Write-Host "Running shipgate check..."
    npx shipgate check $Spec
    Write-Host "Running shipgate gate..."
    npx shipgate gate $Spec --impl (Join-Path $ProjectDir "src") 2>&1 | Out-Null
    Write-Host "E2E from pack: OK"
} finally {
    Remove-Item -Recurse -Force $Consumer -ErrorAction SilentlyContinue
}
