---
title: CI/CD Integration
description: Add ShipGate verification to GitHub Actions, GitLab CI, and other pipelines.
---

ShipGate integrates with CI/CD pipelines to gate deployments. Every pull request gets a SHIP/NO_SHIP verdict based on verification results.

## GitHub Actions

### Using the official action

The simplest way to add ShipGate to GitHub Actions:

```yaml
# .github/workflows/shipgate.yml
name: ShipGate Verify

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: ShipGate Verify
        uses: guardiavault-oss/isl-gate-action@v1
        with:
          mode: auto          # auto | strict | specless
          threshold: 80       # Minimum trust score to SHIP
          spec-path: specs/   # Path to ISL spec files
          impl-path: src/     # Path to implementation
```

### Action inputs

| Input        | Default    | Description                                    |
| ------------ | ---------- | ---------------------------------------------- |
| `mode`       | `auto`     | `auto` — ISL where specs exist, specless elsewhere. `strict` — require specs for all code. `specless` — no specs, use heuristic checks. |
| `threshold`  | `80`       | Minimum trust score (0-100) to pass             |
| `spec-path`  | `specs/`   | Path to ISL specification files                 |
| `impl-path`  | `src/`     | Path to implementation files                    |
| `fail-on`    | `error`    | Fail on `error`, `warning`, or `unspecced`      |

### Action outputs

The action sets these outputs for use in subsequent steps:

| Output       | Description                         |
| ------------ | ----------------------------------- |
| `verdict`    | `SHIP`, `WARN`, or `NO_SHIP`       |
| `score`      | Trust score (0-100)                 |
| `summary`    | Human-readable verification summary |

### PR comments

The action automatically posts a verification summary as a PR comment:

```
## ShipGate Verification

**Verdict: SHIP** ✅ | Trust Score: 92/100

### Results
- ✅ 12 preconditions verified
- ✅ 8 postconditions verified
- ✅ 3 invariants hold
- ⚠️ 1 temporal SLA not measured (no runtime data)

### Evidence Bundle
Proof bundle: `evidence/proof-bundle-abc123.json`
```

### Using the CLI directly

If you prefer more control, use the CLI directly in your workflow:

```yaml
name: ShipGate Gate

on:
  pull_request:
    branches: [main]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"

      - run: npm ci

      - name: Install ShipGate CLI
        run: npm install -g @isl-lang/cli

      - name: Verify specs
        run: shipgate verify specs/ --impl src/ --ci --fail-on error

      - name: Run gate
        run: |
          shipgate gate specs/api.isl \
            --impl src/ \
            --threshold 85 \
            --ci \
            --output evidence/
```

## GitLab CI

```yaml
# .gitlab-ci.yml
shipgate-verify:
  stage: test
  image: node:20
  script:
    - npm ci
    - npm install -g @isl-lang/cli
    - shipgate verify specs/ --impl src/ --ci --format json
  artifacts:
    reports:
      junit: evidence/results.xml
    paths:
      - evidence/
  rules:
    - if: $CI_MERGE_REQUEST_ID
```

## Generic CI (any platform)

ShipGate works with any CI system that can run Node.js. Use the `--ci` flag for machine-readable output:

```bash
# Install
npm install -g @isl-lang/cli

# Verify with JSON output
shipgate verify specs/ --impl src/ --ci --format json

# Gate with exit code
shipgate gate specs/api.isl --impl src/ --threshold 80 --ci
# Exit code 0 = SHIP, Exit code 1 = NO_SHIP
```

## Trust score thresholds

Configure the minimum trust score for different environments:

| Environment | Recommended Threshold | Rationale                    |
| ----------- | --------------------- | ---------------------------- |
| Development | 60                    | Allow experimentation        |
| Staging     | 80                    | Catch issues before prod     |
| Production  | 95                    | High confidence required     |

```yaml
# Different thresholds per branch
- name: Gate (staging)
  if: github.base_ref == 'staging'
  run: shipgate gate specs/ --impl src/ --threshold 80 --ci

- name: Gate (production)
  if: github.base_ref == 'main'
  run: shipgate gate specs/ --impl src/ --threshold 95 --ci
```

## Specless mode in CI

Even without ISL specs, ShipGate can verify code using heuristic checks:

```yaml
- name: Specless verification
  run: shipgate verify src/ --ci --fail-on error
```

Specless mode checks for:
- Hardcoded credentials and secrets
- Missing authentication on sensitive routes
- PII in logs
- Ghost imports (importing modules that don't exist)
- Hallucinated APIs

See [Specless Mode](/guides/specless-mode/) for details.

## Caching

Speed up CI runs by caching ShipGate's analysis data:

```yaml
- uses: actions/cache@v4
  with:
    path: |
      .isl-gate/
      node_modules/.cache/shipgate
    key: shipgate-${{ hashFiles('specs/**/*.isl') }}
```
