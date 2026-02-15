# Dogfood: ISL Vibe Pipeline
# Runs the todo app prompt through the pipeline and reports results.
#
# Usage: .\scripts\dogfood-vibe-pipeline.ps1
#
# Prerequisites:
#   - pnpm install
#   - pnpm --filter @isl-lang/translator build
#
# Note: Full vibe CLI (isl vibe) requires ANTHROPIC_API_KEY/OPENAI_API_KEY and
# may fail to build due to security-scanner dependency. This script uses the
# pattern-based isl-pipeline for Stage 1-4.

$ErrorActionPreference = "Stop"
$prompt = 'A todo app where users can register and log in. Each user has their own todo lists. Todos have a title, description, due date, priority (low/medium/high), and completed status. Users can create, edit, delete, and reorder todos. There''s a dashboard showing overdue todos, today''s todos, and upcoming todos. Users can filter by priority and search by title.'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " ISL Vibe Pipeline Dogfood" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Prompt: $prompt" -ForegroundColor Gray
Write-Host ""

# Build translator (ensures TODO_APP pattern is included)
Write-Host "Building @isl-lang/translator..." -ForegroundColor Yellow
pnpm --filter @isl-lang/translator build

# Run pattern-based pipeline
$outputDir = "./dogfood-output"
Write-Host "Running isl-pipeline generate..." -ForegroundColor Yellow
pnpm --filter @isl-lang/pipeline exec tsx src/cli.ts generate $prompt --output $outputDir --verbose

Write-Host ""
Write-Host "Output written to $outputDir" -ForegroundColor Green
Write-Host "See dogfood-report.md for full analysis." -ForegroundColor Gray
