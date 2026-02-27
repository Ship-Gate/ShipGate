# Completeness System Quick Start

## Overview

The Platform Completion Program tracks package completion status and generates prioritized backlogs to drive completion work.

## Quick Commands

```bash
# Generate full completeness report
pnpm completeness:report

# Check all packages for completeness
pnpm completeness:check

# Generate prioritized backlog
pnpm completeness:backlog

# Initialize manifests for complete packages (dry-run)
pnpm completeness:init --status complete

# Initialize manifests for complete packages (apply)
pnpm completeness:init:apply --status complete
```

## Status Values

- **`shell`**: Stub/incomplete package
- **`partial`**: Real implementation, missing some deliverables
- **`complete`**: All required deliverables present

## Required Deliverables for "complete"

1. ✅ **Exports**: Proper `package.json` exports configuration
2. ✅ **Tests**: Test files exist and test script is not stubbed
3. ✅ **Docs**: README.md with meaningful content (100+ chars) or docs/
4. ✅ **Sample Usage**: Examples, demo, or usage in README

## Creating a Capability Manifest

### Option 1: Central Manifest Directory

Create `.capability-manifests/<package-name>.json`:

```json
{
  "name": "@isl-lang/package-name",
  "status": "complete",
  "updatedAt": "2026-02-09T12:00:00.000Z",
  "notes": "Optional notes"
}
```

### Option 2: Package-Specific Manifest

Create `packages/<package>/capability-manifest.json`:

```json
{
  "name": "@isl-lang/package-name",
  "status": "partial",
  "updatedAt": "2026-02-09T12:00:00.000Z"
}
```

## Workflow

1. **Check Status**: `pnpm completeness:check`
2. **Review Report**: `cat reports/completeness.md`
3. **Update Manifest**: Edit manifest file to reflect actual status
4. **Verify**: `pnpm completeness:check:ci` (will fail if status doesn't match deliverables)

## CI Enforcement

The CI workflow (`.github/workflows/completeness-gate.yml`) will:
- ✅ Scan all packages on push/PR
- ❌ Fail if any package claims "complete" but lacks deliverables
- 📊 Generate completeness report on main branch

## Initialization

To bootstrap manifests for packages that are already complete:

```bash
# Preview what would be created
pnpm completeness:init --status complete

# Actually create the manifests
pnpm completeness:init:apply --status complete
```

## Reports

- `reports/completeness.json` - Machine-readable completeness data
- `reports/completeness-backlog.json` - Prioritized backlog data
- `reports/completeness.md` - Human-readable dashboard

## Example: Updating a Package Status

```bash
# 1. Check current status
pnpm completeness:check

# 2. Review what's missing
cat reports/completeness.json | jq '.packages[] | select(.name == "@isl-lang/my-package")'

# 3. Add missing deliverables (tests, docs, etc.)

# 4. Update manifest
echo '{
  "name": "@isl-lang/my-package",
  "status": "complete",
  "updatedAt": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'"
}' > .capability-manifests/my-package.json

# 5. Verify
pnpm completeness:check:ci
```

## Priority Calculation

Packages are prioritized by:
- **Dependency Count**: How many packages depend on this
- **Core Status**: Whether this is a core/essential package
- **Blocking**: Whether incomplete status blocks other packages
- **Product Impact**: Estimated product impact score (0-10)

See `reports/completeness-backlog.json` for full priority scores.
