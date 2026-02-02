# Changelog

All notable changes to `islstudio` will be documented in this file.

## [0.1.1] - 2026-02-02

### Added
- **SARIF output** for GitHub Security tab (`--output sarif`)
- **Rules CLI** commands:
  - `islstudio rules list` - List all rules with severity
  - `islstudio rules explain <id>` - Detailed fix guidance
  - `islstudio rules pack list` - List policy packs
- **Baseline support** for legacy code adoption:
  - `islstudio baseline create` - Capture current violations
  - `islstudio baseline show` - View baseline summary
  - `islstudio baseline clear` - Remove baseline
- **Inline suppressions** with required justification:
  ```typescript
  // islstudio-ignore pii/console-in-production: Development debugging only
  ```
- **`--changed-only` flag** for git-based file filtering
- **GitHub Check Annotations** for inline PR feedback

### Fixed
- Deterministic evidence fingerprints (stable across runs)

## [0.1.0] - 2026-02-01

### Added
- Initial release
- Core gate engine with SHIP/NO_SHIP verdicts
- 20 built-in rules across 4 policy packs:
  - `auth/*` - Authentication & authorization
  - `pii/*` - Privacy & data protection
  - `payments/*` - Payment security
  - `rate-limit/*` - Rate limiting & DoS protection
- Evidence bundle generation (manifest, results, HTML report)
- SHA-256 signed evidence fingerprints
- `--explain` flag for detailed fix guidance
- Policy pack presets (`startup-default`, `strict-security`, etc.)
- JSON output for CI integration
