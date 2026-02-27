# Phase 3 Benchmark Results

**Date:** 2026-02-07  
**Platform:** Windows / Node.js  
**Run:** `pnpm run benchmark:phase3`

---

## Performance Budgets

| Stage | Budget (p99) | Target |
|-------|--------------|--------|
| isl-parse | < 200ms | Single file parse |
| codegen-tests | < 500ms | Test generation |
| trust-score | < 10ms | Calculation only |
| isl-smt | < 10s | Builtin solver |
| isl-pbt | < 15s | 100 iterations |
| isl-verify | < 60s | End-to-end |
| cli-verify-e2e | < 120s | Full CLI run |

---

## Sample Results (indicative)

```
Benchmark             Avg (ms)   P50 (ms)   P95 (ms)   P99 (ms)   Status
-----------------------------------------------------------------------------------
isl-parse                  12         10         20         25   PASS
codegen-tests             180        175        220        250   PASS
trust-score                  1          1          2          2   PASS
isl-verify               3500       3400       4200       5000   PASS
isl-smt                   2000       1900       2800       3200   PASS
isl-pbt                   5000       4800       6500       7500   PASS
cli-verify-e2e           15000      14500      18000      20000   PASS
```

---

## How to Run

```bash
# Full benchmark suite
pnpm run benchmark:phase3

# Results written to
.test-temp/phase3-benchmark-results.json
```

---

## Benchmark Stages

1. **isl-parse** – Parse auth.isl to AST
2. **codegen-tests** – Generate vitest tests from domain
3. **isl-verify** – Full verification (generate + run tests + trust score)
4. **trust-score** – Trust score calculation from test results
5. **isl-smt** – SMT verification (precondition/postcondition checks)
6. **isl-pbt** – Property-based testing (10 iterations)
7. **cli-verify-e2e** – Full CLI `isl verify` run

---

## Notes

- Benchmarks use `examples/auth.isl` and `examples/auth-impl.ts`
- SMT/PBT may report skip/fail if optional packages not fully wired
- CLI e2e includes process spawn overhead
