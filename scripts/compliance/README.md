# Compliance Scripts

This directory contains scripts for ensuring enterprise compliance readiness.

## Scripts

### `verify-licenses.ts`

Verifies that all packages in the monorepo have consistent MIT licensing.

**Usage:**
```bash
pnpm compliance:verify-licenses
```

**Checks:**
- All `package.json` files contain `"license": "MIT"`
- Core packages include LICENSE files
- Reports any missing or non-MIT licenses

**Exit Codes:**
- `0` - All packages compliant
- `1` - License violations found

### `generate-third-party-notices.ts`

Generates a comprehensive `THIRD_PARTY_NOTICES.txt` file with attribution for all dependencies.

**Usage:**
```bash
pnpm compliance:generate-notices
```

**Output:** `THIRD_PARTY_NOTICES.txt`

**Contents:**
- All dependencies with versions
- License information
- License text (when available)
- Author and repository information

### `generate-sbom.ts`

Generates a Software Bill of Materials in CycloneDX format.

**Usage:**
```bash
pnpm compliance:generate-sbom
```

**Output:** `sbom.json` (CycloneDX 1.5 format)

**Contents:**
- Component inventory (all dependencies)
- License information
- Package URLs (purl)
- External references
- Component hashes

## Running All Checks

```bash
pnpm compliance:all
```

This runs all three compliance checks in sequence.

## CI Integration

These scripts are automatically run in CI:

- **License verification** runs on every PR/push
- **SBOM and notices generation** runs during releases

See `.github/workflows/ci.yml` and `.github/workflows/release.yml` for details.
