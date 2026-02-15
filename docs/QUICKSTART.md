# ShipGate — 60-Second Quickstart

## What You'll Get

- **Verify** — Code checked against ISL specs (or inferred behavior when no specs exist)
- **Gate** — SHIP/NO_SHIP verdict with evidence
- **CI-ready** — GitHub workflow that blocks PRs on violations

## Prerequisites

- Node.js 18+
- A TypeScript/JavaScript (or Python/Go) project

---

## 60-Second Flow

```bash
cd your-repo
npx shipgate init
npx shipgate verify .
```

`verify .` produces a **SHIP** or **NO_SHIP** verdict. When you have explicit ISL specs and implementation paths:

```bash
npx shipgate gate specs/auth.isl --impl src/
```

### Step 1: Initialize (~30 seconds)

```bash
npx shipgate init
```

Creates:

- `.shipgate.yml` — ShipGate configuration
- `isl.config.json` — ISL project config
- `.github/workflows/shipgate.yml` — CI workflow (if GitHub detected)
- Optional starter ISL specs (when you choose to generate)

### Step 2: Verify (~20 seconds)

```bash
npx shipgate verify .
```

Verifies your code against ISL specs. Auto-detects mode:

- **ISL** — Path has `.isl` specs for code files
- **Specless** — Code only; ShipGate infers expectations
- **Mixed** — ISL where specs exist, specless elsewhere

Output includes a **SHIP** or **NO_SHIP** verdict.

### Step 3: Gate (when you have spec + impl)

```bash
npx shipgate gate <spec.isl> --impl <path>
```

Example:

```bash
npx shipgate gate specs/auth.isl --impl src/auth.ts
npx shipgate gate specs/payments.isl --impl src/
```

Returns a SHIP/NO_SHIP decision with evidence bundle.

---

## Config

ShipGate reads `.shipgate.yml` from your project root. Two common modes:

### Code Scanning Mode (CI / Specless)

For projects that scan code without requiring ISL specs:

```yaml
version: 1

ci:
  fail_on: error
  specless_mode: on
  ignore:
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/*.test.*"
    - "**/*.spec.*"

scanning:
  hallucinations: true
  fake_features: true
  secrets: true
  vulnerabilities: true

generate:
  output: .shipgate/specs
  min_confidence: 0.3
```

### ISL Verification Mode (Specs + Evidence)

For projects with explicit ISL specs and strict verification:

```yaml
version: 1

specs:
  include:
    - "src/**/*.isl"

verify:
  strict: true
  policies:
    auth:
      enabled: true
    rate-limit:
      enabled: true
    pii:
      enabled: true

evidence:
  output_dir: ".shipgate/evidence"
```

---

## Run Locally

```bash
# Quick verify (produces SHIP/NO_SHIP)
npx shipgate verify src/

# JSON for CI
npx shipgate verify src/ --json

# Gate with explicit spec + impl
npx shipgate gate specs/auth.isl --impl src/auth.ts
```

---

## Troubleshooting

### "No files found"

ShipGate looks in `src/` by default. Use a path:

```bash
npx shipgate verify .
npx shipgate verify src/
```

### "Too many violations"

Adjust strictness:

```bash
npx shipgate verify . --fail-on warning
```

Or create a baseline for legacy code (see [docs](https://shipgate.dev/docs/getting-started)).

### False positive

Suppress with inline comment:

```typescript
// shipgate-ignore pii/console-in-production: Debug only, removed before prod
console.log(data);
```

---

## Links

- [Full Documentation](https://shipgate.dev/docs/getting-started)
- [Config Reference](https://shipgate.dev/docs/config)
- [Report Issues](https://github.com/Ship-Gate/ShipGate/issues)
