# Tier 3 Verification Guide

Complete guide to property-based testing and mutation testing provers in the ISL verification pipeline.

## Overview

Tier 3 verification catches edge cases and validates test quality through adversarial testing:

- **Tier 1 (Static)**: Fast static analysis (< 10s)
- **Tier 2 (Runtime)**: Application runtime verification (30-60s)
- **Tier 3 (Adversarial)**: Property-based + mutation testing (2-5 min)

## Property-Based Testing

Generates hundreds of random inputs to verify invariants hold across all possible inputs.

### Invariants Tested

**POST/PUT Endpoints:**
- `valid_input_success`: Valid input → 2xx status (never 500)
- `invalid_input_client_error`: Invalid input → 4xx status (never 500, never 2xx)
- `response_type_match`: Response matches declared type shape
- `auth_enforced`: No random input bypasses authentication

**GET Endpoints:**
- `nonexistent_id_404`: Non-existent ID → 404 (not 500)
- `malformed_id_400`: Malformed ID → 400 (not 500)
- `no_500_on_input`: No input causes 500
- `idempotency`: Same request returns same result

### Usage

```typescript
import { PropertyTestProver } from '@isl-lang/verify-pipeline';
import { parse } from '@isl-lang/parser';

const domain = parse(specContent).domain;

const prover = new PropertyTestProver({
  thoroughness: 'standard', // 'quick' | 'standard' | 'thorough'
  seed: 12345, // For reproducibility
  timeout: 5000,
  verbose: true,
});

const result = await prover.run(domain, implementation);

console.log(PropertyTestProver.formatResult(result));
```

### Thoroughness Levels

- **Quick**: 20 random inputs per endpoint (~30s)
- **Standard**: 100 random inputs per endpoint (~2 min)
- **Thorough**: 500 random inputs per endpoint (~5 min)

### Output

```typescript
interface PropertyTestResult {
  proof: 'PROVEN' | 'PARTIAL' | 'FAILED';
  score: number; // 0-100
  evidence: PropertyTestEvidence[];
  summary: {
    totalInputs: number;
    invariantsHeld: number;
    invariantsBroken: number;
    criticalFailures: number; // Auth or 500 errors
  };
}
```

## Mutation Testing

Proves tests catch real bugs by intentionally breaking code and verifying tests fail.

### Mutation Types

**Security-Critical (Prioritized):**
- `AUTH_REMOVAL`: Remove authentication middleware → tests must fail
- `VALIDATION_REMOVAL`: Remove input validation → tests must fail
- `HASH_SKIP`: Remove password hashing → tests must fail
- `PERMISSION_ESCALATE`: Change role check from 'admin' to 'user' → tests must fail

**Standard:**
- `BOUNDARY_FLIP`: Change `>=` to `>`, `===` to `!==`
- `ERROR_SWALLOW`: Replace catch block with empty catch
- `RETURN_NULL`: Replace return value with null

### Usage

```typescript
import { MutationTestProver } from '@isl-lang/verify-pipeline';

const prover = new MutationTestProver({
  thoroughness: 'standard',
  files: ['src/**/*.ts'],
  testCommand: 'npm test',
  timeout: 30000,
  verbose: true,
});

const result = await prover.run();

console.log(MutationTestProver.formatResult(result));
```

### Scoring

```typescript
interface MutationTestResult {
  proof: 'PROVEN' | 'PARTIAL' | 'FAILED';
  score: number; // Overall mutation score
  securityScore: number; // Security mutations only
  summary: {
    mutationScore: number; // % of mutations killed
    securityMutationScore: number; // % of security mutations killed
    survived: number; // Mutations tests missed
  };
}
```

**Proof Levels:**
- **PROVEN**: ≥80% overall AND ≥95% security mutations killed
- **PARTIAL**: ≥60% overall OR ≥80% security mutations killed
- **FAILED**: <80% security mutations killed

## CLI Usage

### Tier 1 Only (Default)

```bash
isl verify
isl verify --spec specs/auth.isl
```

Fast static analysis only.

### Tier 2 (Runtime)

```bash
isl verify --runtime
isl verify --runtime --spec specs/auth.isl
```

Static + runtime verification (requires app can start).

### Tier 3 (Full Adversarial)

```bash
isl verify --deep
isl verify --deep --property-tests thorough
isl verify --deep --mutation-tests standard
isl verify --deep --seed 12345 --verbose
```

Full verification stack with property-based and mutation testing.

### Specific Tier

```bash
isl verify --tier 3
isl verify --tier 2
```

### Output Formats

```bash
# Console (default)
isl verify --deep

# JSON (for CI/CD)
isl verify --deep --format json --output proof-bundle.json

# Markdown (for documentation)
isl verify --deep --format markdown --output PROOF.md
```

## Proof Bundle Commands

### Show Bundle

```bash
isl bundle show proof-bundle.json
```

Pretty-print proof bundle with all tier results.

### Verify Bundle Integrity

```bash
isl bundle verify proof-bundle.json
```

Verify bundle signatures and file hashes.

### Compare Bundles

```bash
isl bundle diff old.json new.json
```

Show what improved or regressed between runs.

## GitHub Action

Add to `.github/workflows/verify.yml`:

```yaml
name: ISL Verify

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: ISL Verify with Proof Bundle
        uses: ./.github/actions/verify-proof-bundle
        with:
          tier: '3'
          spec: 'specs/auth.isl'
          require-proven: 'auth-coverage,input-validation,secret-exposure'
          min-trust-score: '80'
          upload-bundle: 'true'
          post-comment: 'true'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Action Outputs

The action automatically:
- ✅ Posts proof bundle summary as PR comment
- ✅ Uploads bundle as GitHub artifact (90 day retention)
- ✅ Compares with base branch bundle (if available)
- ✅ Sets job status based on verdict and score

### PR Comment Example

```markdown
## 🔒 ISL Verify — Proof Bundle

**Trust Score: 87/100** — ✅ PROVEN

### Tier 1: Static Analysis
| Property | Status |
|----------|--------|
| Import Integrity | ✅ PROVEN |
| Auth Coverage | ✅ PROVEN |
| Secret Exposure | ✅ PROVEN |

### Tier 3: Adversarial Testing
- **Property Tests**: 23/23 invariants held (2,300 random inputs tested)
- **Mutation Testing**: 87% mutation score, 92% security score

---
*Verified with ISL Tier 3 • 2026-02-17T16:11:00Z*
```

## Configuration

### Property Tests

```typescript
{
  propertyTests: {
    enabled: true,
    thoroughness: 'standard', // 'quick' | 'standard' | 'thorough'
    seed: 12345, // Optional: for reproducibility
  }
}
```

### Mutation Tests

```typescript
{
  mutationTests: {
    enabled: true,
    thoroughness: 'standard',
    files: ['src/**/*.ts'],
    testCommand: 'npm test',
  }
}
```

## Exit Codes

- `0`: PROVEN (all verification passed)
- `1`: FAILED (critical failures detected)
- `2`: INCOMPLETE_PROOF (some checks couldn't be evaluated)

## Performance

### Quick Mode (~1 min)
```bash
isl verify --deep --property-tests quick --mutation-tests quick
```

- Property tests: 20 inputs/endpoint
- Mutation tests: 5 mutations/file, security-only

### Standard Mode (~3 min)
```bash
isl verify --deep
```

- Property tests: 100 inputs/endpoint
- Mutation tests: 20 mutations/file, all types

### Thorough Mode (~10 min)
```bash
isl verify --deep --property-tests thorough --mutation-tests thorough
```

- Property tests: 500 inputs/endpoint
- Mutation tests: 50 mutations/file, all types

## Best Practices

1. **Start with Tier 1** in development for fast feedback
2. **Use Tier 2** in pre-commit hooks
3. **Run Tier 3** in CI/CD on PRs
4. **Use `--seed`** for reproducible property test failures
5. **Upload bundles** as artifacts for audit trail
6. **Compare bundles** between commits to track verification improvements

## Residual Risks

Even with Tier 3 verification, some risks remain:

- **Business logic correctness**: Not statically verifiable
- **Load/performance**: Not tested
- **Third-party dependencies**: Runtime behavior not verified
- **Complex state machines**: May require manual verification

## Troubleshooting

### Property tests timeout

```bash
isl verify --deep --property-tests quick --verbose
```

Reduce inputs or increase timeout.

### Mutation tests slow

```bash
isl verify --deep --mutation-tests quick
```

Security mutations only, or reduce file count.

### Bundle upload fails

Check GitHub token permissions and artifact retention settings.

## Examples

See `packages/isl-verify-pipeline/examples/` for complete examples:

- `basic-tier3/` - Simple property + mutation testing
- `ci-integration/` - GitHub Action setup
- `proof-bundles/` - Bundle comparison workflows
