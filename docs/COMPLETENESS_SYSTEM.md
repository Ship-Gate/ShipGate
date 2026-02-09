# Platform Completion Program

## Overview

The Platform Completion Program tracks and enforces package completion status across the monorepo. It ensures that packages claiming "complete" status actually have all required deliverables, and generates prioritized backlogs to drive completion work.

## Components

### 1. Capability Manifest

Each package can declare its completion status via a capability manifest:

- **Location**: `.capability-manifests/<package-name>.json` or `packages/<package>/capability-manifest.json`
- **Format**: See `.capability-manifests/README.md`

**Status Values:**
- `shell`: Stub/incomplete package
- `partial`: Real implementation, missing some deliverables
- `complete`: All required deliverables present

### 2. Completeness Checker

Validates that packages claiming "complete" status actually have all required deliverables.

**Required Deliverables:**
- ✅ **Exports**: Proper `package.json` exports configuration
- ✅ **Tests**: Test files exist and test script is not stubbed
- ✅ **Docs**: README.md with meaningful content or docs/ directory
- ✅ **Sample Usage**: Examples, demo, or usage in README

**Usage:**
```bash
# Check all packages
pnpm completeness:check

# CI mode (fails on mismatches)
pnpm completeness:check:ci
```

### 3. Prioritized Backlog Generator

Ranks packages by:
- **Dependency Count**: How many packages depend on this
- **Core Status**: Whether this is a core/essential package
- **Blocking**: Whether incomplete status blocks other packages
- **Product Impact**: Estimated product impact score (0-10)

**Usage:**
```bash
pnpm completeness:backlog
```

### 4. Completeness Report

Generates a markdown dashboard report at `reports/completeness.md` showing:
- Package status breakdown
- Status mismatches (declared vs assessed)
- Missing deliverables per package
- Prioritized completion backlog

**Usage:**
```bash
# Generate full report
pnpm completeness:report

# CI mode
pnpm completeness:report:ci
```

## CI Integration

The `completeness-gate.yml` workflow runs on:
- Push to `main` branch
- Pull requests affecting packages or completeness scripts

**Jobs:**
1. **completeness-check**: Scans all packages and generates reports
2. **completeness-enforcement**: Fails if any package claims "complete" but lacks deliverables
3. **completeness-report**: Generates full markdown report (main branch only)

## Workflow

1. **Declare Status**: Create capability manifest declaring package status
2. **Check**: Run `pnpm completeness:check` to validate
3. **Fix**: Address any missing deliverables
4. **Report**: Run `pnpm completeness:report` to see prioritized backlog
5. **Complete**: Update manifest to `complete` when all deliverables are present

## Example

```bash
# 1. Check current status
pnpm completeness:check

# 2. See what's missing
cat reports/completeness.json

# 3. Generate prioritized backlog
pnpm completeness:backlog

# 4. Generate full report
pnpm completeness:report

# 5. View dashboard
cat reports/completeness.md
```

## Acceptance Test

Running `pnpm completeness:report` should output:
- ✅ List of all packages with status
- ✅ Actionable missing items per package
- ✅ Dependency-weighted priority order
- ✅ Markdown dashboard at `reports/completeness.md`

## Files

- `scripts/completeness-schema.ts`: Type definitions
- `scripts/completeness-checker.ts`: Validation logic
- `scripts/completeness-backlog.ts`: Priority calculation
- `scripts/completeness-report.ts`: Markdown generation
- `scripts/completeness.ts`: Main entry point
- `.github/workflows/completeness-gate.yml`: CI integration
- `.capability-manifests/`: Central manifest directory
