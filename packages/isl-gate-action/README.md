# Shipgate ISL Verify

**One YAML file between your AI and production.**

Shipgate verifies AI-generated code against ISL behavior contracts in your CI/CD pipeline. Returns SHIP or NO_SHIP.

## Quick Start (GitHub Actions)

```yaml
# .github/workflows/shipgate.yml
name: Shipgate
on: [pull_request]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: shipgate/isl-verify@v1
        with:
          spec: specs/auth.isl           # optional - auto-discovers .isl files
          implementation: src/            # code to verify
          threshold: 70                   # minimum score to pass (0-100)
```

That's it. PRs that fail verification are blocked from merging.

## How It Works

1. Developer writes ISL spec (or `shipgate init` generates one from existing code)
2. AI or human writes the implementation
3. On PR, Shipgate runs verification:
   - **Spec gate**: Parses ISL spec, type-checks it, generates tests, runs them against implementation
   - **Firewall**: Scans changed files for auth bypass, hardcoded secrets, ghost routes, PII in logs
4. Returns `SHIP` (merge allowed) or `NO_SHIP` (merge blocked)

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `spec` | No | auto-discover | Path to ISL spec file |
| `implementation` | No | `.` | Path to implementation file or directory |
| `threshold` | No | `70` | Minimum score to SHIP (0-100) |
| `fail-on-no-ship` | No | `true` | Fail the workflow on NO_SHIP |
| `comment-on-pr` | No | `true` | Post results as PR comment |
| `upload-evidence` | No | `true` | Upload evidence bundle as artifact |
| `dependency-audit` | No | `false` | Run dependency audit |

## Outputs

| Output | Description |
|--------|-------------|
| `verdict` | `SHIP` or `NO_SHIP` |
| `score` | Verification score (0-100) |
| `sources` | Comma-separated verification sources |
| `evidence-path` | Path to evidence bundle |

## GitLab CI

```yaml
# .gitlab-ci.yml
shipgate:
  stage: test
  image: node:20
  script:
    - npm install -g @isl-lang/cli
    - shipgate verify specs/auth.isl --impl src/ --ci
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
```

## Generic CI (npm script)

```json
{
  "scripts": {
    "gate": "shipgate gate specs/auth.isl --impl src/ --ci",
    "verify": "shipgate verify specs/auth.isl --impl src/ --ci"
  }
}
```

```bash
# Any CI system
npm run gate
# Exit code 0 = SHIP, 1 = NO_SHIP
echo $?
```

## CLI Usage

```bash
# Install
npm install -g @isl-lang/cli

# Initialize ISL project (scaffolds .isl files from existing code)
shipgate init

# Verify implementation against spec
shipgate verify specs/auth.isl --impl src/auth.ts

# Full gate with evidence bundle
shipgate gate specs/auth.isl --impl src/ --output ./evidence

# CI mode (JSON stdout, one-line stderr summary, exit code)
shipgate verify specs/auth.isl --impl src/ --ci
# stdout: { "success": true, "trustScore": 92, ... }
# stderr: Shipgate: SHIP (score: 92/100)

# Enable all verification modes
shipgate verify specs/auth.isl --impl src/ --all
# Runs: SMT + PBT + Temporal + Standard verification
```

## What Gets Checked

| Check | Spec Required | Description |
|-------|---------------|-------------|
| Preconditions | Yes | Input validation, guards |
| Postconditions | Yes | Output correctness, state changes |
| Invariants | Yes | Properties that must always hold |
| Temporal | Yes | Latency SLAs, eventual consistency |
| Auth bypass | No | Middleware that never checks tokens |
| Hardcoded secrets | No | Passwords, API keys in source |
| Ghost routes | No | Endpoints not in truthpack |
| PII in logs | No | Sensitive data leaked to console |

## Pricing

- **Free**: Unlimited repos, CLI + CI gate, community support
- **Team ($49/mo)**: 5 repos, dashboard, drift detection
- **Enterprise**: Custom pricing, SSO, audit logs

## Links

- [Documentation](https://shipgate.dev/docs)
- [ISL Language Reference](https://shipgate.dev/docs/isl)
- [Examples](https://github.com/shipgate/examples)
