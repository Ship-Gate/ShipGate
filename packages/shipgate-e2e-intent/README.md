# Shipgate E2E Intent Verification

**The only thing investors care about: does the gate actually catch bad code?**

This package contains integration test fixtures that prove Shipgate's core value proposition. Each fixture pairs a `good.ts` (compliant) and `bad.ts` (violating) implementation against an ISL spec, then asserts that the verification engine correctly distinguishes them.

## Fixtures

| Fixture | What it proves | Bad code does... | Expected verdict |
|---------|---------------|------------------|-----------------|
| `typed-signature-mismatch` | Spec catches return type drift | Returns `number` instead of `User` | FAIL |
| `postcondition-violation` | Spec catches broken postconditions | Returns empty `id`, zero `total` | FAIL |
| `error-spec-violation` | Spec catches missing error handling | No validation on invalid input | FAIL |
| `side-effect-mismatch` | Spec catches undeclared side effects | Writes to filesystem despite `no_file_writes` | FAIL/WARN |
| `shallow-auto-spec` | Auto-gen specs have low coverage | Trivial single-function file | WARN/NO_SHIP |
| `vitest-fails` | Broken imports block shipping | Imports nonexistent module | NO_SHIP |
| `ai-rule-speculative` | Spec without postconditions = low confidence | Missing error handling + wrong return | WARN |
| `ai-rule-validated` | Strong postconditions + PBT = high confidence | Token value too short, no TTL check | FAIL |

## Running

```bash
# Run all intent verification fixtures
pnpm --filter @isl-lang/shipgate-e2e-intent test

# Update snapshots after intentional changes
pnpm --filter @isl-lang/shipgate-e2e-intent test:update-snapshots

# CI mode (JSON output)
pnpm --filter @isl-lang/shipgate-e2e-intent test:ci
```

## Fixture Structure

Each fixture directory contains:

```
fixtures/<name>/
  spec.isl          # ISL specification (omitted for shallow-auto-spec)
  good.ts           # Compliant implementation → should SHIP or WARN
  bad.ts            # Violating implementation → should FAIL or NO_SHIP
  expected.json     # Assertion constraints (verdict, score, message patterns)
```

## How It Works

1. **Parse** the ISL spec via `@isl-lang/parser`
2. **Verify** each `.ts` file against the parsed AST via `@isl-lang/isl-verify`
3. **Decide** verdict via `@shipgate/sdk` `decideGate()`
4. **Assert** against `expected.json` constraints
5. **Snapshot** full output for CI regression detection

## Key Invariant

> For every fixture: `good.ts` score ≥ `bad.ts` score

This is the proof that Shipgate creates meaningful signal separation between compliant and violating code.
