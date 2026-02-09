# Compliance Documentation

This document describes the compliance processes and tools for enterprise adoption readiness.

## Overview

The IntentOS project maintains compliance with enterprise requirements through:

1. **License Verification** - Ensures all packages use MIT licensing consistently
2. **Third-Party Attribution** - Generates comprehensive attribution notices
3. **Software Bill of Materials (SBOM)** - Produces CycloneDX format SBOMs for security scanning

## License Compliance

All packages in this monorepo are licensed under the MIT License. The compliance system verifies:

- All `package.json` files contain `"license": "MIT"`
- Core packages include LICENSE files
- Consistent licensing across the entire codebase

### Running License Verification

```bash
# Verify all packages have MIT license
pnpm compliance:verify-licenses
```

This script will:
- Scan all packages in the monorepo
- Report any missing or non-MIT licenses
- Warn about core packages missing LICENSE files

## Third-Party Notices

The project generates a comprehensive `THIRD_PARTY_NOTICES.txt` file that includes:

- All dependencies with their versions
- License information for each dependency
- License text (when available)
- Author and repository information

### Generating Third-Party Notices

```bash
# Generate THIRD_PARTY_NOTICES.txt
pnpm compliance:generate-notices
```

The output file (`THIRD_PARTY_NOTICES.txt`) contains:
- Header with generation timestamp
- Individual entries for each dependency
- License text for each dependency (when available)
- Repository and homepage links

## Software Bill of Materials (SBOM)

The project generates CycloneDX format SBOMs for security scanning and compliance tracking.

### SBOM Format

The SBOM follows the [CycloneDX 1.5 specification](https://cyclonedx.org/specification/overview/):

- **Format**: CycloneDX JSON
- **Spec Version**: 1.5
- **Components**: All dependencies with metadata
- **Metadata**: Build timestamp, tool information, component version

### Generating SBOM

```bash
# Generate sbom.json (CycloneDX format)
pnpm compliance:generate-sbom
```

The generated `sbom.json` includes:
- Component inventory (all dependencies)
- License information
- Package URLs (purl) for each component
- External references (homepage, repository)
- Component hashes

### Using SBOM

The SBOM can be used for:
- Security vulnerability scanning
- License compliance auditing
- Dependency tracking
- Supply chain security analysis

Tools that support CycloneDX:
- [Dependency-Track](https://dependencytrack.org/)
- [Snyk](https://snyk.io/)
- [GitHub Dependency Review](https://github.com/dependabot/dependency-review-action)
- [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/)

## CI Integration

Compliance checks are automatically run in CI:

### Continuous Integration (CI)

The `compliance-licenses` job runs on every PR and push:
- Verifies all packages have MIT license
- Fails the build if any package is non-compliant

### Release Workflow

During releases, the following compliance artifacts are generated:
- `THIRD_PARTY_NOTICES.txt` - Third-party attribution
- `sbom.json` - Software Bill of Materials

These artifacts are:
- Uploaded as GitHub Actions artifacts
- Retained for 365 days
- Included in release packages

## Running All Compliance Checks

To run all compliance checks at once:

```bash
pnpm compliance:all
```

This will:
1. Verify license compliance
2. Generate third-party notices
3. Generate SBOM

## Manual Compliance Audit

For enterprise audits, follow these steps:

1. **Verify Licensing**
   ```bash
   pnpm compliance:verify-licenses
   ```

2. **Generate Attribution**
   ```bash
   pnpm compliance:generate-notices
   ```

3. **Generate SBOM**
   ```bash
   pnpm compliance:generate-sbom
   ```

4. **Review Artifacts**
   - Check `THIRD_PARTY_NOTICES.txt` for complete attribution
   - Review `sbom.json` for dependency inventory
   - Verify all licenses are acceptable for your use case

## Compliance Scripts

All compliance scripts are located in `scripts/compliance/`:

- `verify-licenses.ts` - License verification
- `generate-third-party-notices.ts` - Attribution generation
- `generate-sbom.ts` - SBOM generation

## License Information

### Project License

This project is licensed under the MIT License. See [LICENSE](../LICENSE) for details.

### Third-Party Licenses

All third-party dependencies and their licenses are documented in `THIRD_PARTY_NOTICES.txt`.

## Enterprise Adoption Checklist

- ✅ Consistent MIT licensing across all packages
- ✅ Automated license verification in CI
- ✅ Third-party attribution generation
- ✅ SBOM generation (CycloneDX format)
- ✅ Compliance artifacts in release workflow
- ✅ Documentation for compliance processes

## Support

For compliance questions or issues:
- Review this documentation
- Check CI logs for compliance job outputs
- Review generated artifacts (`THIRD_PARTY_NOTICES.txt`, `sbom.json`)
