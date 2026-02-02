# ISL Studio - 5 Minute Quickstart

## What You'll Build

A GitHub workflow that:
- ✅ Blocks PRs with auth bypass, PII leaks, or payment issues
- ✅ Posts a comment with violations and fix guidance
- ✅ Creates tamper-proof evidence for every decision

## Prerequisites

- A GitHub repository with TypeScript/JavaScript code
- GitHub Actions enabled

## Step 1: Initialize (30 seconds)

```bash
cd your-repo
npx islstudio init
```

This creates:
- `.islstudio/config.json` - Policy configuration
- `.github/workflows/isl-gate.yml` - CI workflow

## Step 2: Commit (30 seconds)

```bash
git add .islstudio .github/workflows/isl-gate.yml
git commit -m "Add ISL Studio gate"
git push
```

## Step 3: Test It (2 minutes)

Create a test branch with a "bad" file:

```bash
git checkout -b test-isl-gate
```

Create `src/bad-auth.ts`:

```typescript
// This has multiple violations ISL Studio will catch

const skipAuth = true; // Auth bypass!

const API_KEY = "sk_live_abc123xyz789"; // Hardcoded credential!

export function getUser(id: string) {
  console.log("Getting user:", { id, ssn: "123-45-6789" }); // PII logging!
  return { id };
}
```

Commit and push:

```bash
git add src/bad-auth.ts
git commit -m "Add bad auth code"
git push -u origin test-isl-gate
```

## Step 4: Open a PR (1 minute)

Open a PR from `test-isl-gate` to `main`.

Watch the action run. You'll see:

```
🛑 ISL Gate: NO_SHIP

Score: 40/100

### Issues Found (3)

🛑 Blockers:
- auth/bypass-detected: AUTH BYPASS: Suspicious pattern "skipAuth"
- auth/hardcoded-credentials: HARDCODED CREDENTIALS: Potential secret
- pii/logged-sensitive-data: PII LOGGING: Sensitive data "ssn" may be logged
```

## Step 5: Fix and Ship (1 minute)

Update `src/bad-auth.ts`:

```typescript
// Fixed version - all clean!

import { rateLimit } from 'express-rate-limit';

const API_KEY = process.env.API_KEY; // From environment

export function getUser(id: string) {
  console.log("Getting user:", { id }); // No PII
  return { id };
}
```

Commit and push:

```bash
git add src/bad-auth.ts
git commit -m "Fix auth issues"
git push
```

The PR comment updates:

```
✅ ISL Gate: SHIP

Score: 100/100

### ✨ All checks passed!
```

Merge with confidence. 🎉

---

## What's Next?

### Explore Rules

```bash
npx islstudio rules list
npx islstudio rules explain auth/bypass-detected
```

### Configure Packs

Edit `.islstudio/config.json`:

```json
{
  "packs": {
    "payments": { "enabled": true }
  }
}
```

### Create Baseline (for legacy code)

```bash
npx islstudio baseline create
git add .islstudio/baseline.json
git commit -m "Add baseline"
```

Now only **new** violations block PRs.

### Run Locally

```bash
# Quick check
npx islstudio gate

# With fix guidance
npx islstudio gate --explain

# JSON for scripts
npx islstudio gate --output json
```

---

## Troubleshooting

### "No files found"

ISL Studio looks in `src/` by default. Use `--all` for entire repo:

```bash
npx islstudio gate --all
```

### "Too many violations"

Create a baseline:

```bash
npx islstudio baseline create
```

### "False positive"

Suppress with inline comment:

```typescript
// islstudio-ignore pii/console-in-production: Debug only, removed before prod
console.log(data);
```

---

## Links

- [Full Documentation](https://github.com/ISL-Studio/ISL-Studio-)
- [Demo Repo](https://github.com/ISL-Studio/islstudio-hello-gate)
- [Report Issues](https://github.com/ISL-Studio/ISL-Studio-/issues)
