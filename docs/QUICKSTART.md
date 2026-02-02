# ISL Studio Quickstart

**Block unsafe PRs in 5 minutes.**

---

## Option 1: GitHub Action (Recommended)

### Step 1: Add the workflow

Create `.github/workflows/isl-gate.yml`:

```yaml
name: ISL Gate
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Run ISL Gate
        run: npx islstudio gate --ci --output json > result.json
      
      - name: Check Result
        run: |
          VERDICT=$(cat result.json | jq -r '.verdict')
          if [ "$VERDICT" = "NO_SHIP" ]; then
            echo "::error::ISL Gate: NO_SHIP"
            exit 1
          fi
```

### Step 2: Open a PR

That's it. ISL Gate will:
- Run on every PR
- Check for auth bypasses, PII leaks, missing rate limits
- Block the merge if unsafe

---

## Option 2: Run Locally

```bash
npx islstudio gate
```

Output:
```
✅ SHIP (95/100)

Files checked: 12
Blockers: 0
Warnings: 1

Fingerprint: a1b2c3d4e5f6g7h8
Evidence: .islstudio/evidence/
```

---

## Option 3: In Your Code

```typescript
import { runGate, loadConfig } from 'islstudio';

const config = await loadConfig(process.cwd());
const result = await runGate([
  { path: 'src/api.ts', content: generatedCode }
], config);

if (result.verdict === 'NO_SHIP') {
  console.log('Blocked:', result.violations);
}
```

---

## Configuration

Create `.islstudio/config.json`:

```json
{
  "preset": "startup-default",
  "packs": {
    "auth": { "enabled": true },
    "pii": { "enabled": true },
    "payments": { "enabled": false },
    "rate-limit": { "enabled": true }
  },
  "threshold": 70
}
```

### Presets

| Preset | Description |
|--------|-------------|
| `startup-default` | Auth + PII + Rate limits (recommended) |
| `strict-security` | All packs, threshold 80 |
| `payments-heavy` | Focus on payment security |
| `privacy-heavy` | Focus on PII protection |
| `agent-mode` | Strict mode for AI agents |

---

## What It Checks

| Category | Examples |
|----------|----------|
| **Auth** | Auth bypass, hardcoded credentials, unprotected routes |
| **PII** | Logging sensitive data, unmasked responses |
| **Rate Limits** | Missing limits on auth endpoints |
| **Payments** | Payment bypass, hardcoded cards, unsigned webhooks |

---

## Evidence

Every run generates an evidence bundle in `.islstudio/evidence/`:

```
.islstudio/evidence/2024-01-15/
├── manifest.json    # What was checked
├── results.json     # Verdict + violations
└── report.html      # Human-readable report
```

The fingerprint is a SHA-256 hash of the inputs, making results reproducible.

---

## Next Steps

- [Policy Pack Reference](./policy-packs.md)
- [Evidence Format](./evidence.md)
- [CI/CD Integration](./ci-cd.md)

---

## Get Help

- GitHub: [isl-lang/isl-studio](https://github.com/isl-lang/isl-studio)
- Discord: [Join our community](https://discord.gg/islstudio)
