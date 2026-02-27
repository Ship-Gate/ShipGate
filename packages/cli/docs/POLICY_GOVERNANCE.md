# Policy & Governance

ShipGate Policy & Governance allows organizations to define policy once and enforce it across all repositories.

## Features

- **Threshold Profiles**: Define strict/standard/lenient profiles with different trust score and confidence requirements
- **Required Evidence Types**: Require specific evidence types (SMT, runtime, PBT) for critical paths like payments
- **Exceptions with Expiry**: Create temporary exceptions with justification and automatic expiry
- **Integration with Gate**: Policy checks are automatically run during `shipgate gate` commands

## Quick Start

### 1. Initialize Policy File

```bash
shipgate policy init-org --org "my-org"
```

This creates a `.shipgate.policy.yml` file in your repository root.

### 2. Configure Policy

Edit `.shipgate.policy.yml`:

```yaml
version: 1
org: "my-org"

profiles:
  strict:
    min_trust_score: 95
    min_confidence: 80
    min_tests: 5
    require_smt: true
    require_runtime: true
    require_pbt: true

  standard:
    min_trust_score: 85
    min_confidence: 60
    min_tests: 3

  lenient:
    min_trust_score: 70
    min_confidence: 40
    min_tests: 1

default_profile: standard

required_evidence:
  - context:
      paths:
        - "**/payment*/**"
        - "**/billing/**"
      behaviors:
        - ".*payment.*"
        - ".*charge.*"
    evidence_types:
      - smt
      - runtime
    severity: error
    description: "Payment operations require SMT proofs and runtime verification"

exceptions: []
```

### 3. Check Policy

```bash
# Check policy against repository
shipgate policy check-org

# Check with specific profile
shipgate policy check-org --profile strict

# CI mode (JSON output)
shipgate policy check-org --ci
```

### 4. Gate Integration

Policy checks are automatically run during `shipgate gate`:

```bash
# Gate with policy checks (default)
shipgate gate spec.isl --impl src/

# Skip policy checks
shipgate gate spec.isl --impl src/ --skip-policy

# Use specific policy file
shipgate gate spec.isl --impl src/ --policy-file .shipgate.policy.yml

# Use specific profile
shipgate gate spec.isl --impl src/ --policy-profile strict
```

## Policy Schema

### Threshold Profiles

Each profile defines minimum requirements:

- `min_trust_score`: Minimum trust score (0-100) to SHIP
- `min_confidence`: Minimum confidence level (0-100)
- `min_tests`: Minimum number of tests required
- `require_smt`: Require SMT solver proofs
- `require_runtime`: Require runtime verification
- `require_pbt`: Require property-based tests

### Required Evidence

Define evidence requirements by context:

```yaml
required_evidence:
  - context:
      paths: ["**/payment*/**"]      # File patterns (glob)
      behaviors: [".*payment.*"]     # Behavior names (regex)
      tags: ["critical"]             # Tags/categories
    evidence_types:
      - smt                          # SMT solver proofs
      - runtime                      # Runtime verification
      - pbt                          # Property-based tests
      - unit                         # Unit tests
      - integration                  # Integration tests
      - chaos                        # Chaos testing
      - formal                       # Formal verification
    severity: error                  # error | warning
    description: "Why this is required"
```

### Exceptions

Create temporary exceptions with expiry:

```yaml
exceptions:
  - id: "payment-temp-exception-001"
    scope:
      paths:
        - "src/payments/legacy/**"
      behaviors:
        - ".*legacy.*"
      rules:
        - "evidence_requirement_payment"
    justification: "Legacy payment code being refactored"
    approved_by: "security-team@example.com"
    expires_at: "2026-03-01T00:00:00Z"
    created_at: "2026-02-01T00:00:00Z"
    active: true
```

## Commands

### `shipgate policy init-org`

Generate a `.shipgate.policy.yml` template.

```bash
shipgate policy init-org --org "my-org"
shipgate policy init-org --org "my-org" --directory /path/to/repo
shipgate policy init-org --force  # Overwrite existing file
```

### `shipgate policy check-org`

Check repository against organization policy.

```bash
shipgate policy check-org
shipgate policy check-org --policy-file .shipgate.policy.yml
shipgate policy check-org --profile strict
shipgate policy check-org --ci  # JSON output for CI
```

### `shipgate gate` (with policy)

Gate command automatically runs policy checks:

```bash
shipgate gate spec.isl --impl src/
shipgate gate spec.isl --impl src/ --skip-policy
shipgate gate spec.isl --impl src/ --policy-profile strict
```

## Policy File Discovery

ShipGate searches for policy files in the following order:

1. `.shipgate.policy.yml` in current directory
2. `.shipgate.policy.yaml` in current directory
3. `shipgate.policy.yml` in current directory
4. `shipgate.policy.yaml` in current directory
5. Search parent directories up to filesystem root
6. Use default policy if none found

## Acceptance Test

A repository violates org policy → `shipgate gate` returns NO_SHIP with explicit policy reason.

```bash
# Create a policy requiring high trust score
cat > .shipgate.policy.yml << EOF
version: 1
profiles:
  strict:
    min_trust_score: 95
    min_confidence: 80
default_profile: strict
required_evidence: []
exceptions: []
EOF

# Run gate with low trust score
shipgate gate spec.isl --impl src/ --policy-profile strict

# Expected: NO-SHIP with policy violation message
```

## Examples

### Strict Policy for Payments

```yaml
version: 1
org: "fintech-corp"

profiles:
  strict:
    min_trust_score: 98
    min_confidence: 90
    min_tests: 10
    require_smt: true
    require_runtime: true
    require_pbt: true

default_profile: strict

required_evidence:
  - context:
      paths: ["**/payment*/**", "**/billing/**"]
    evidence_types: ["smt", "runtime", "pbt"]
    severity: error
    description: "All payment operations require formal proofs"
```

### Exception Workflow

```yaml
exceptions:
  - id: "legacy-auth-exception"
    scope:
      paths: ["src/auth/legacy/**"]
    justification: "Legacy auth code scheduled for removal Q2 2026"
    approved_by: "security@example.com"
    expires_at: "2026-06-30T00:00:00Z"
    created_at: "2026-02-01T00:00:00Z"
    active: true
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# GitHub Actions
- name: Policy Check
  run: shipgate policy check-org --ci

# Or integrate with gate
- name: Gate with Policy
  run: shipgate gate spec.isl --impl src/ --ci
```

## Best Practices

1. **Start with Standard Profile**: Use the standard profile as default, reserve strict for critical paths
2. **Document Exceptions**: Always provide clear justification and set realistic expiry dates
3. **Review Exceptions Regularly**: Set up alerts for expiring exceptions
4. **Version Control**: Commit `.shipgate.policy.yml` to your repository
5. **Org-Level Policies**: Place policy files in org-level repos or use symlinks

## Troubleshooting

### Policy file not found

ShipGate uses default policy if no file is found. To use a specific file:

```bash
shipgate gate spec.isl --impl src/ --policy-file /path/to/.shipgate.policy.yml
```

### Policy validation errors

Check the error message for specific field issues:

```bash
shipgate policy check-org --policy-file .shipgate.policy.yml
```

### Exceptions not working

Ensure exceptions are:
- Active (`active: true`)
- Not expired (`expires_at` is in the future)
- Match the scope (paths/behaviors/rules)
