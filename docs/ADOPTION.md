# Shipgate - Adoption Guide

## 2-Minute Setup for Any Repo

### Option 1: One Command (Recommended)

```bash
npx shipgate init
```

This creates:
- `.shipgate/config.json` - Policy configuration
- `.github/workflows/isl-gate.yml` - CI workflow
- Optional baseline for existing violations

Then commit and push:
```bash
git add .shipgate .github/workflows/isl-gate.yml
git commit -m "Add Shipgate gate"
git push
```

### Option 2: GitHub Action Only

Add `.github/workflows/isl-gate.yml`:

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

## What Gets Blocked?

| Category | Examples |
|----------|----------|
| **Auth** | Bypass patterns, hardcoded credentials, unprotected routes |
| **PII** | Logged sensitive data, unmasked responses, missing encryption |
| **Payments** | Payment bypass, client-side prices, unsigned webhooks |
| **Rate Limit** | Missing limits on auth/API endpoints |
| **Intent** | Code that violates declared Shipgate specifications |

## Not Breaking Existing Code

### Create a Baseline

Don't want to fix 200 existing issues? Baseline them:

```bash
npx shipgate baseline create
git add .shipgate/baseline.json
git commit -m "Add Shipgate baseline"
```

Now only **new** violations block PRs.

### Suppress Specific Violations

```typescript
// shipgate-ignore pii/console-in-production: Debug logging, removed before release
console.log(userData);
```

### Configure Packs

`.shipgate/config.json`:
```json
{
  "preset": "startup-default",
  "packs": {
    "auth": { "enabled": true },
    "pii": { "enabled": true },
    "payments": { "enabled": false },
    "intent": { "enabled": true }
  }
}
```

## Presets

| Preset | Auth | PII | Payments | Rate Limit | Intent | Threshold |
|--------|------|-----|----------|------------|--------|-----------|
| `startup-default` | ✅ | ✅ | ❌ | ✅ | ✅ | 70 |
| `strict-security` | ✅ | ✅ | ✅ | ✅ | ✅ | 90 |
| `minimal` | ✅ | ❌ | ❌ | ❌ | ❌ | 50 |
| `payments-heavy` | ✅ | ✅ | ✅ | ✅ | ✅ | 80 |

## Run Locally

```bash
# Check all files
npx shipgate gate

# Check with detailed fix guidance
npx shipgate gate --explain

# Only changed files
npx shipgate gate --changed-only

# JSON output for CI
npx shipgate gate --ci --output json
```

## Target Repos

Shipgate works best with:

- **Express/Fastify/Nest APIs** - Auth, rate limiting, PII
- **Next.js apps** - API routes, auth, data handling
- **Payment integrations** - Stripe, payment security
- **Any TS/JS with auth or user data**

## The Value Proposition

> "Let your agent build. We decide if it ships — with receipts."

- **Zero config** to start
- **Baseline** keeps legacy code from failing
- **Evidence** for every decision (tamper-proof)
- **Fix guidance** for every violation

## Links

- [GitHub Action](https://github.com/shipgate/gate-action)
- [Demo Repo](https://github.com/shipgate/shipgate-hello-gate)
- [npm Package](https://npmjs.com/package/shipgate)
