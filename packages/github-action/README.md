# ISL Verify GitHub Action

Verify ISL (Intent Specification Language) specifications and implementations in your CI/CD pipeline.

## Features

- **Syntax & Type Checking**: Validate ISL specification files
- **Implementation Verification**: Verify that code matches specifications
- **GitHub Annotations**: Inline error and warning annotations in PRs
- **Job Summary**: Rich verification reports in GitHub Actions
- **Proof Bundles**: Upload verification proofs as artifacts
- **Code Generation**: Generate TypeScript types and test files

## Usage

### Basic Usage

```yaml
name: ISL Verification
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Verify ISL Specs
        uses: isl-lang/verify-action@v1
        with:
          specs: 'src/**/*.isl'
```

### With Implementation Verification

```yaml
- name: Verify ISL Specs
  uses: isl-lang/verify-action@v1
  with:
    specs: 'specs/**/*.isl'
    implementation: 'src/auth.ts'
    fail-on-warning: true
```

### With Type Generation

```yaml
- name: Verify and Generate Types
  uses: isl-lang/verify-action@v1
  with:
    specs: 'src/**/*.isl'
    generate-types: true
    generate-tests: true
```

### Full Example

```yaml
name: ISL Verification
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install Dependencies
        run: npm ci
      
      - name: Verify ISL Specs
        id: isl
        uses: isl-lang/verify-action@v1
        with:
          specs: 'specs/**/*.isl'
          implementation: 'src/services/auth.ts'
          fail-on-warning: true
          fail-threshold: 80
          upload-proofs: true
      
      - name: Upload Proof Bundle
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: isl-proofs
          path: .isl/proofs/
      
      - name: Report Results
        if: always()
        run: |
          echo "Verdict: ${{ steps.isl.outputs.verdict }}"
          echo "Score: ${{ steps.isl.outputs.score }}"
          echo "Errors: ${{ steps.isl.outputs.errors }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `specs` | Glob pattern for ISL spec files | Yes | `src/**/*.isl` |
| `implementation` | Path to implementation file | No | - |
| `check-only` | Only run syntax/type checking | No | `false` |
| `fail-on-warning` | Fail if warnings are found | No | `false` |
| `fail-threshold` | Minimum score to pass (0-100) | No | `0` |
| `generate-types` | Generate TypeScript types | No | `false` |
| `generate-tests` | Generate test files | No | `false` |
| `upload-proofs` | Upload proof bundles | No | `false` |
| `working-directory` | Working directory | No | `.` |

## Outputs

| Output | Description |
|--------|-------------|
| `verdict` | Verification verdict (`verified`, `risky`, `unsafe`, `unchecked`) |
| `score` | Verification score (0-100) |
| `errors` | Number of errors found |
| `warnings` | Number of warnings found |
| `specs-checked` | Number of spec files checked |
| `coverage-preconditions` | Precondition coverage % |
| `coverage-postconditions` | Postcondition coverage % |
| `coverage-invariants` | Invariant coverage % |

## Verdicts

| Verdict | Description |
|---------|-------------|
| `verified` | All specifications verified against implementation |
| `risky` | Some specifications could not be fully verified |
| `unsafe` | Implementation does not match specification |
| `checked` | Specifications checked (no implementation provided) |
| `unchecked` | Not checked |

## GitHub Annotations

The action creates inline annotations for errors and warnings:

```
❌ ISL002: Unknown type 'Rolee' at src/auth.isl:15:10
⚠️ ISL101: Consider adding temporal constraints at src/auth.isl:12:1
```

## Job Summary

The action generates a rich job summary with:

- Verdict badge
- Coverage metrics with progress bars
- Error and warning details
- Configuration summary

## Example Output

```
═══════════════════════════════════════════════════════════
                    ISL Verification Summary                
═══════════════════════════════════════════════════════════

  Verdict:         ✅ VERIFIED
  Score:           94/100
  Specs Checked:   5
  Errors:          0
  Warnings:        2
  Duration:        1.2s

  Coverage:
    Preconditions:  ████████████████████ 100%
    Postconditions: ██████████████████░░ 92%
    Invariants:     ████████████████████ 100%
    Temporal:       █████████████████░░░ 85%

═══════════════════════════════════════════════════════════
```

## License

MIT
