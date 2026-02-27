# ISL Proof Benchmark

**Purpose:** Prove that ISL catches bad AI-generated code.

## The Claim

> "ISL catches 100% of known bad implementations in our corpus."

This benchmark runs the gate against:
- **Good impl** → Should get SHIP (approves correct code)
- **Bad impl** → Should get NO-SHIP (catches bugs)

## Run

```bash
pnpm proof:benchmark
# or
pnpm exec tsx proof/run-proof-benchmark.ts
```

## Output

- `proof/report.json` — Machine-readable results
- `proof/PROOF_REPORT.md` — Publishable report

## Adding to Corpus

Edit `proof/corpus.json` to add specs with good/bad impl pairs. Each entry needs:

- `specPath` — Path to ISL spec
- `goodImpl` — Implementation that satisfies the spec
- `badImpl` — Implementation with known bugs (AI-style mistakes)
- `knownBugs` — List of bugs in the bad impl (for documentation)

## Current Status

- **Primary proof:** Bad code → NO-SHIP (100% in current corpus)
- **Secondary:** Good code → SHIP (depends on spec/parser compatibility)

Some specs in the corpus use ISL dialects that may not fully parse with the current parser. The benchmark still validates that bad implementations are caught.
