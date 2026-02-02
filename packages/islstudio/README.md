# ISL Studio

**Ship decisions with receipts.** Block risky PRs before merge with tamper-proof evidence.

[![npm version](https://img.shields.io/npm/v/islstudio.svg)](https://www.npmjs.com/package/islstudio)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
npx islstudio init
```

This creates everything you need:
- `.islstudio/config.json` - Policy configuration
- `.github/workflows/isl-gate.yml` - CI workflow

Commit and push:
```bash
git add .islstudio .github
git commit -m "Add ISL Studio gate"
git push
```

Open a PR to see it in action. ✨

## What Gets Blocked?

25 rules across 5 packs:

| Pack | Examples |
|------|----------|
| **auth** | Bypass patterns, hardcoded credentials, unprotected routes |
| **pii** | Logged sensitive data, unmasked API responses |
| **payments** | Payment bypass, unsigned webhooks, client-side prices |
| **rate-limit** | Missing limits on auth/API endpoints |
| **intent** | Code violating declared ISL specifications |

## CLI Commands

```bash
# Run the gate
npx islstudio gate

# With detailed fix guidance
npx islstudio gate --explain

# Only changed files (for PRs)
npx islstudio gate --changed-only

# JSON/SARIF output for CI
npx islstudio gate --output json
npx islstudio gate --output sarif

# Explore rules
npx islstudio rules list
npx islstudio rules explain auth/bypass-detected

# Baseline for legacy code
npx islstudio baseline create
```

## GitHub Action

```yaml
name: ISL Gate

on: pull_request

permissions:
  contents: read
  pull-requests: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ISL-Studio/islstudio-gate-action@v1
```

## Configuration

`.islstudio/config.json`:

```json
{
  "preset": "startup-default",
  "packs": {
    "auth": { "enabled": true },
    "pii": { "enabled": true },
    "payments": { "enabled": false },
    "intent": { "enabled": true }
  },
  "threshold": 70
}
```

### Presets

- `startup-default` - Auth + PII + Rate-limit (recommended)
- `strict-security` - All packs, 90% threshold
- `minimal` - Auth only, 50% threshold

## Baseline (Legacy Code)

Don't want to fix 200 existing issues?

```bash
npx islstudio baseline create
git add .islstudio/baseline.json
```

Now only **new** violations block PRs.

## Suppressions

```typescript
// islstudio-ignore pii/console-in-production: Debug logging, removed before release
console.log(userData);
```

## Scoring

| Severity | Deduction | Blocks? |
|----------|-----------|---------|
| error | -20 | Always |
| warning | -10 | If score < threshold |
| info | -2 | Never |

Default threshold: 70

## VS Code Extension

Coming soon! Real-time diagnostics as you code.

## Links

- [GitHub](https://github.com/ISL-Studio/ISL-Studio-)
- [Demo Repo](https://github.com/ISL-Studio/islstudio-hello-gate)
- [Adoption Guide](https://github.com/ISL-Studio/ISL-Studio-/blob/main/docs/ADOPTION.md)

## License

MIT
