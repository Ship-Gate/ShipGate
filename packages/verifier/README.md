# @isl-lang/verifier

Evidence-first, deterministic verification engine for ISL specifications.

## Overview

This verifier produces reproducible, deterministic reports by:
- **No timestamps**: All output is stable across runs
- **Stable ordering**: Clause results, evidence, and artifacts are alphabetically sorted
- **Stable identifiers**: All IDs are computed from content hashes
- **Evidence links**: Every verdict is backed by traceable evidence

## Installation

```bash
pnpm add @isl-lang/verifier
```

## Quick Start

```typescript
import { verify, createSpec } from '@isl-lang/verifier';

// Define your spec
const spec = createSpec('UserDomain', [
  {
    name: 'CreateUser',
    preconditions: ['input.email.length > 0'],
    postconditions: ['result.email == input.email'],
  },
]);

// Run verification
const report = verify(spec, {
  workspaceRoot: './my-project',
});

console.log(`Verdict: ${report.verdict}`);
console.log(`Score: ${report.score}/100`);
```

## Interpreting Results

### Verdict: SHIP vs NO_SHIP

- **SHIP**: Score meets threshold (default 80) AND no blocking issues
- **NO_SHIP**: Score below threshold OR blocking issues present

### Blocking Issues (always NO_SHIP)

| Issue | Description |
|-------|-------------|
| `SECURITY_FAIL` | Any security clause has FAIL status |
| `POSTCONDITION_FAIL` | Any postcondition has FAIL status |
| `NO_BINDINGS` | No implementation bindings found |
| `NO_TESTS` | No test files detected |

### Clause Statuses

| Status | Meaning | Confidence |
|--------|---------|------------|
| `PASS` | All evidence confirms clause holds | 70-100% |
| `PARTIAL` | Some evidence, but incomplete | 20-50% |
| `FAIL` | Evidence demonstrates violation | 100% |
| `SKIPPED` | Cannot evaluate (no bindings) | 0% |

## Interpreting Failures

### FAIL on Postcondition

```
✗ [FAIL   ] UserDomain.CreateUser.postcondition.0
    Expression: result.email == input.email
    Reason: Assertion failed: 1 failure(s)
    Evidence:
      - [assertion_fail] tests/user.test.ts:45
        expect(result.email).toBe(input.email)
```

**What to check:**
1. Open `tests/user.test.ts` at line 45
2. Review the failing assertion
3. Check if implementation returns correct email

### PARTIAL on Precondition

```
◐ [PARTIAL] UserDomain.CreateUser.precondition.0
    Expression: input.email.length > 0
    Reason: Binding found but no test coverage detected
```

**How to fix:**
1. Add test for empty email validation:
   ```typescript
   it('should reject empty email', () => {
     expect(() => createUser({ email: '' })).toThrow();
   });
   ```

### SKIPPED (No Binding)

```
○ [SKIPPED] UserDomain.DeleteUser.postcondition.0
    Expression: not User.exists(id: input.userId)
    Reason: No implementation binding found
```

**How to fix:**
1. Implement and export `deleteUser` function
2. Ensure function name matches behavior name

## Reproduction Steps

Every report includes an `inputHash` for verification:

```bash
# Run verification
pnpm verify --workspace ./my-project --spec ./spec.isl

# Verify reproducibility
pnpm verify --workspace ./my-project --spec ./spec.isl --expect-hash abc123def456
```

Same inputs always produce same hash and identical reports.

## Raising Coverage

### 1. Add Test Assertions

The verifier looks for assertions that match clause expressions:

```typescript
// For postcondition: result.email == input.email
it('should preserve email in result', () => {
  const result = createUser({ email: 'test@example.com' });
  expect(result.email).toBe('test@example.com');  // Matches!
});
```

### 2. Export Implementation Functions

Bindings are detected from exports:

```typescript
// src/createUser.ts
export async function createUser(input: CreateUserInput): Promise<User> {
  // ...
}
```

### 3. Name Tests Descriptively

Test names help match clauses:

```typescript
describe('CreateUser', () => {  // Matches behavior name
  describe('preconditions', () => {  // Helps match clause type
    it('should require non-empty email', () => {  // Describes clause
```

### 4. Cover All Clause Types

| Clause Type | Test Pattern |
|-------------|--------------|
| Precondition | `should reject invalid...`, `should require...` |
| Postcondition | `should return...`, `should create...` |
| Invariant | `should maintain...`, `should preserve...` |
| Security | `should deny...`, `should validate token...` |

## Scoring Weights

| Component | Weight | Description |
|-----------|--------|-------------|
| Preconditions | 20% | Input validation coverage |
| Postconditions | 30% | Output correctness coverage |
| Invariants | 15% | Domain rule coverage |
| Security | 20% | Security constraint coverage |
| Bindings | 10% | Implementation completeness |
| Test Coverage | 5% | Overall test presence |

## API Reference

### verify(spec, options)

Main verification function.

```typescript
const report = verify(spec, {
  workspaceRoot: string,       // Required: project root
  behavior?: string,           // Optional: specific behavior
  testPatterns?: string[],     // Optional: glob patterns for tests
  implPatterns?: string[],     // Optional: glob patterns for implementation
  shipThreshold?: number,      // Optional: score threshold (default: 80)
});
```

### createSpec(domain, behaviors, invariants?)

Helper to create spec from raw data.

```typescript
const spec = createSpec('MyDomain', [
  {
    name: 'MyBehavior',
    preconditions: ['expr1', 'expr2'],
    postconditions: ['expr3'],
    invariants: ['expr4'],
    security: ['expr5'],
    temporal: ['expr6'],
  },
], [
  { name: 'GlobalInvariant', predicates: ['expr7'] },
]);
```

### scanWorkspace(options)

Scan workspace for test files, bindings, and assertions.

```typescript
const artifacts = scanWorkspace({
  workspaceRoot: './my-project',
  testPatterns: ['**/*.test.ts'],
  implPatterns: ['**/src/**/*.ts'],
});
```

### Report Formatting

```typescript
import { formatReportText, formatReportMarkdown } from '@isl-lang/verifier';

// Human-readable text
console.log(formatReportText(report));

// Markdown (for CI comments)
console.log(formatReportMarkdown(report));
```

## Determinism Guarantees

1. **Same inputs = Same output**: Hash verification proves reproducibility
2. **No timestamps**: Reports contain no date/time values
3. **Stable ordering**: All arrays sorted alphabetically
4. **Stable IDs**: Evidence IDs computed from content hashes

Verify determinism:
```typescript
import { serializeReport } from '@isl-lang/verifier';

const report1 = verify(spec, options);
const report2 = verify(spec, options);

// These will be identical
JSON.stringify(report1) === JSON.stringify(report2); // true
```

## License

MIT
