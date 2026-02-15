# Shipgate

**Ship decisions with receipts.** Block risky PRs before merge with tamper-proof evidence.

[![npm version](https://img.shields.io/npm/v/shipgate.svg)](https://www.npmjs.com/package/shipgate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Quick Start

```bash
npx shipgate init
```

This creates everything you need:
- `.shipgate/config.json` - Policy configuration
- `.github/workflows/isl-gate.yml` - CI workflow

Commit and push:
```bash
git add .shipgate .github
git commit -m "Add Shipgate gate"
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
npx shipgate gate

# With detailed fix guidance
npx shipgate gate --explain

# Only changed files (for PRs)
npx shipgate gate --changed-only

# JSON output (healer-compatible)
npx shipgate gate --json
npx shipgate gate --output json

# SARIF output (GitHub Security tab)
npx shipgate gate --output sarif

# Explore rules
npx shipgate rules list
npx shipgate rules explain auth/bypass-detected

# Baseline for legacy code
npx shipgate baseline create
```

## Machine-Readable Output (Healer Integration)

For automated healing systems, use `--json` to get stable machine-readable output:

```bash
npx shipgate gate --json > gate-result.json
```

### GateResult JSON Schema

```typescript
interface GateResult {
  verdict: 'SHIP' | 'NO_SHIP';      // Final decision
  score: number;                     // 0-100 score
  violations: RuleViolation[];       // Array of detected violations
  fingerprint: string;               // Stable 16-char hash (violations-based)
  policyBundleVersion: string;       // e.g., "1.0.0"
  rulepackVersions: RulepackVersion[]; // Version info per rulepack
  summary: {
    filesChecked: number;
    blockers: number;
    warnings: number;
  };
  timestamp: string;                 // ISO 8601 timestamp
}

interface RuleViolation {
  ruleId: string;                    // e.g., "auth/bypass-detected"
  ruleName: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  tier: 'hard_block' | 'soft_block' | 'warn';
  filePath?: string;
  line?: number;
  suggestion?: string;
}

interface RulepackVersion {
  id: string;                        // e.g., "auth"
  version: string;                   // e.g., "0.1.0"
  rulesCount: number;
}
```

### Example JSON Output

```json
{
  "verdict": "NO_SHIP",
  "score": 75,
  "violations": [
    {
      "ruleId": "auth/bypass-detected",
      "ruleName": "Auth Bypass Detected",
      "severity": "error",
      "message": "Potential auth bypass via debug parameter",
      "tier": "hard_block",
      "filePath": "src/auth.ts",
      "line": 15,
      "suggestion": "Remove debug bypass or gate behind feature flag"
    }
  ],
  "fingerprint": "a1b2c3d4e5f6a7b8",
  "policyBundleVersion": "1.0.0",
  "rulepackVersions": [
    { "id": "auth", "version": "0.1.0", "rulesCount": 5 },
    { "id": "pii", "version": "0.1.0", "rulesCount": 4 }
  ],
  "summary": {
    "filesChecked": 42,
    "blockers": 1,
    "warnings": 2
  },
  "timestamp": "2026-02-02T12:00:00.000Z"
}
```

### Fingerprint Stability

The `fingerprint` field is a stable SHA-256 hash based on:
- Violations (ruleId, filePath, line, tier)
- Policy bundle version

**Same violations = same fingerprint**, regardless of file content changes. This allows healers to:
- Track violation state across runs
- Detect when violations are actually fixed vs. just moved
- Identify recurring issues

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
      - uses: shipgate/gate-action@v1
```

## Configuration

`.shipgate/config.json`:

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
npx shipgate baseline create
git add .shipgate/baseline.json
```

Now only **new** violations block PRs.

## Suppressions

```typescript
// shipgate-ignore pii/console-in-production: Debug logging, removed before release
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

- [GitHub](https://github.com/shipgate/shipgate)
- [Demo Repo](https://github.com/shipgate/shipgate-hello-gate)
- [Adoption Guide](https://github.com/shipgate/shipgate/blob/main/docs/ADOPTION.md)

## License

MIT
