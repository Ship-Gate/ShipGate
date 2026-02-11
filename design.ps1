# ==========================================
# WEDNESDAY SKILLS -> CURSOR RULES (LOCAL)
# Uses: skills/wednesday-design/SKILL.md + skills/wednesday-dev/SKILL.md
# ==========================================

$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
$pkgRoot = "node_modules/@wednesday-solutions-eng/ai-agent-skills"

if (-not (Test-Path $pkgRoot)) { throw "Package not found at: $pkgRoot. Install it with: pnpm add -D @wednesday-solutions-eng/ai-agent-skills --ignore-workspace-root-check" }

$designPath = Join-Path $pkgRoot "skills\wednesday-design\SKILL.md"
$devPath    = Join-Path $pkgRoot "skills\wednesday-dev\SKILL.md"

if (-not (Test-Path $designPath)) { throw "Missing: $designPath" }
if (-not (Test-Path $devPath))    { throw "Missing: $devPath" }

$designContent = Get-Content $designPath -Raw
$devContent    = Get-Content $devPath -Raw

$cursorDir = Join-Path $repo ".cursor\rules"
$ctxDir    = Join-Path $repo "ai-context"

New-Item -ItemType Directory -Force -Path $cursorDir | Out-Null
New-Item -ItemType Directory -Force -Path $ctxDir | Out-Null

$cursorRule = Join-Path $cursorDir "frontend-design.md"
@"
# FRONTEND DESIGN RULESET (Wednesday-based)

You are a senior frontend engineer. These rules are mandatory.

----------------------------------------
WEDNESDAY DESIGN SKILL
----------------------------------------
$designContent

----------------------------------------
WEDNESDAY DEV SKILL
----------------------------------------
$devContent

----------------------------------------
NON-NEGOTIABLE OUTPUT RULES
----------------------------------------
- Prefer clarity over cleverness
- Semantic HTML first
- Accessible defaults (labels, focus, contrast)
- Consistent spacing & hierarchy
- Reusable composable components
- Avoid overengineering
- Production-ready code only
"@ | Set-Content $cursorRule -Encoding UTF8

$ctxPack = Join-Path $ctxDir "frontend-skill-pack.md"
@"
SYSTEM INSTRUCTION — FRONTEND SKILL PACK

You MUST follow this skill system for all UI/layout/component/UX decisions.

----------------------------------------
WEDNESDAY DESIGN SKILL
----------------------------------------
$designContent

----------------------------------------
WEDNESDAY DEV SKILL
----------------------------------------
$devContent
"@ | Set-Content $ctxPack -Encoding UTF8

Write-Host "✨ DONE" -ForegroundColor Magenta
Write-Host "Cursor rule:  $cursorRule" -ForegroundColor Cyan
Write-Host "Context pack: $ctxPack" -ForegroundColor Cyan
