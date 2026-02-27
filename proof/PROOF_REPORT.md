# ISL Proof Benchmark Report

**Generated:** 2026-02-08T09:31:28.871Z

## Summary

| Metric | Value |
|--------|-------|
| Specs tested | 2 |
| Good code approved (SHIP) | 0/2 |
| Bad code caught (NO-SHIP) | 2/2 |
| Total known bugs in corpus | 6 |
| **Proof valid** | ✓ Yes |

## Results by Spec

### Money Transfer (demo-gate)
- **Good impl:** ✗ NO-SHIP (score: 0)
- **Bad impl:** ✓ NO-SHIP (caught) (score: 0)
- **Known bugs:** 3
  - No check if sender has sufficient funds (negative balance possible)
  - No check if amount is positive (theft vector)
  - No check if sender != receiver (same-account transfer)

### Authentication (verification-demo)
- **Good impl:** ✗ NO-SHIP (score: 0)
- **Bad impl:** ✓ NO-SHIP (caught) (score: 0)
- **Known bugs:** 3
  - Console.log in production (PII risk)
  - Rate limit after body parsing (wrong order)
  - Missing audit on exit paths


## How to Run

```bash
pnpm exec tsx proof/run-proof-benchmark.ts
```
