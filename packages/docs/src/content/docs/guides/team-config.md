---
title: Team Configuration
description: Set up organization-wide policies and team conventions for ShipGate.
---

ShipGate supports team-wide policies through a `.shipgate-team.yml` configuration file. This lets organizations enforce consistent verification standards across all projects.

## Getting started

Generate a team config template:

```bash
shipgate policy team-init --team "my-team"
```

This creates a `.shipgate-team.yml` file in your project root.

## Configuration file

```yaml
# .shipgate-team.yml
team: engineering
version: "1.0"

# Minimum trust score to pass gate
gate:
  threshold: 85
  fail-on: error    # error | warning | unspecced

# Require ISL specs for specific paths
coverage:
  required:
    - src/api/**         # All API routes must have specs
    - src/services/**    # All services must have specs
  exempt:
    - src/utils/**       # Utility files don't need specs
    - src/types/**       # Type-only files are exempt

# Verification settings
verification:
  pbt: true              # Enable property-based testing
  pbt-tests: 100         # Number of PBT iterations
  chaos: true            # Enable chaos testing
  temporal: false         # Disable temporal verification (no runtime data)
  smt: true              # Enable SMT solver for formal verification

# Security policies
security:
  block-hardcoded-secrets: true
  require-auth-on-routes: true
  block-pii-in-logs: true
  max-rate-limit: 1000

# Quality gates
quality:
  min-spec-score: 70     # Minimum spec quality score
  require-scenarios: true # All behaviors must have scenarios
  require-error-cases: true # All behaviors must define error cases
```

## Policy enforcement

### Check policies locally

```bash
# Validate your repo against team policies
shipgate policy check

# With a specific config file
shipgate policy check --team-config .shipgate-team.yml
```

### Check policies in CI

```yaml
- name: Team policy check
  run: shipgate policy check --team-config .shipgate-team.yml
```

## Policy bundles

For organizations managing multiple projects, create a reusable policy bundle:

### Create a bundle

```bash
# Create a policy bundle from current config
shipgate policy bundle create \
  --output team-policy.json \
  --description "Engineering team verification standards"
```

### Apply a bundle

```bash
# Verify a bundle against current project
shipgate policy bundle verify team-policy.json
```

### Bundle options

```bash
# Only include high-severity rules
shipgate policy bundle create \
  --output critical-only.json \
  --min-severity error

# Include configuration overrides
shipgate policy bundle create \
  --output custom.json \
  --config policy-overrides.json
```

## Spec quality scoring

Enforce minimum quality standards for ISL specifications:

```bash
# Score a spec file
shipgate spec-quality user-service.isl

# Fail if quality is below threshold
shipgate spec-quality user-service.isl --min-score 70

# Get detailed fix suggestions
shipgate spec-quality user-service.isl --fix
```

Quality is scored on five dimensions:

| Dimension       | Weight | What it measures                                |
| --------------- | ------ | ----------------------------------------------- |
| Completeness    | 25%    | Are all behaviors fully specified?               |
| Specificity     | 25%    | Are assertions concrete and verifiable?          |
| Security        | 20%    | Are auth, rate limits, and data protection covered? |
| Testability     | 15%    | Can the spec be automatically tested?            |
| Consistency     | 15%    | Do naming and patterns follow conventions?       |

Example output:

```
Spec Quality: user-service.isl

  Completeness:  85/100  ✓
  Specificity:   90/100  ✓
  Security:      70/100  ⚠  Missing rate_limit on CreateUser
  Testability:   95/100  ✓
  Consistency:   80/100  ✓

Overall: 84/100  ✓ (threshold: 70)
```

## Trust score configuration

Customize how trust scores are calculated:

```bash
# Custom category weights
shipgate gate:trust-score spec.isl \
  --impl src/ \
  --weights "preconditions=30,postconditions=25,invariants=20,temporal=10,chaos=5,coverage=10"

# Custom threshold
shipgate gate:trust-score spec.isl \
  --impl src/ \
  --threshold 90

# Penalty for uncovered categories
shipgate gate:trust-score spec.isl \
  --impl src/ \
  --unknown-penalty 0.5
```

## Trust score history

Track trust scores over time:

```bash
# View trust score history
shipgate gate:trust-score spec.isl --impl src/ --history

# Tag with git commit
shipgate gate:trust-score spec.isl \
  --impl src/ \
  --commit-hash $(git rev-parse HEAD)
```

History is stored in `.isl-gate/trust-history.json` by default.
