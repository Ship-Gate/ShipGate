# Phase 3: Verification — Detailed Roadmap

> **Goal:** Complete SMT Solver Integration, Property-Based Testing, and Chaos Engineering to bring the ISL verification story from proof-of-concept to production-ready.

---

## Current State Summary

| Component | Package(s) | Status | Coverage |
|-----------|-----------|--------|----------|
| Expression Evaluator | `verifier-runtime` | Partial | ~60% |
| SMT Solver Integration | `isl-smt`, `verifier-formal`, `formal-verification` | Partial | ~30% |
| Property-Based Testing | `isl-pbt` | Mostly complete | ~75% |
| Chaos Engineering | `verifier-chaos` | Mostly complete | ~70% |
| Verify Pipeline | `isl-verify-pipeline` | Partial | ~50% |
| Proof Bundles | `isl-proof` | Complete | ~90% |
| Security Verifier | `verifier-security` | Complete | ~85% |
| Temporal Verifier | `verifier-temporal` | Partial | ~65% |
| Test Generation | `codegen-tests`, `test-generator` | Partial | ~40% |
| Trust Score | N/A | Not started | 0% |

---

## Milestone 0: Unblock the Build (P0 — Blocks Everything)

**Goal:** Get `pnpm build && pnpm typecheck && pnpm test` to exit 0.

Everything in Phase 3 is blocked until the monorepo builds and tests can run.

### 0.1 Fix Missing Dependencies
- [ ] Add `picocolors` to the relevant `tsup` / `packages` that need it
- [ ] Add `next` module to `playground` workspace or exclude playground from the build
- [ ] Fix `spec-assist` workspace lockfile entry (`pnpm install` should resolve)
- **Acceptance:** `pnpm install` completes without warnings about missing workspaces

### 0.2 Fix TypeScript Errors
- [ ] Fix `ClickRipple` type error in `demos/AnimatedBackground.tsx`
- [ ] Fix any other TS errors surfaced by `pnpm typecheck`
- [ ] Audit demo packages — mark non-critical demos as `private: true` or exclude from build
- **Acceptance:** `pnpm typecheck` exits 0

### 0.3 Validate Test Suite Baseline
- [ ] Run `pnpm test` and record baseline pass/fail counts
- [ ] Triage failing tests: categorize as (a) real bugs, (b) missing fixtures, (c) flaky
- [ ] Fix or skip non-Phase-3 test failures to establish a green baseline
- **Acceptance:** `pnpm test` exits 0 with >90% pass rate; CI green

### 0.4 Package Consolidation: `formal-verification` vs `verifier-formal`
- [ ] Audit both packages for overlapping functionality (`formal-verification/src/smt.ts` vs `isl-smt`, `formal-verification/src/verifier.ts` vs `verifier-formal/src/translator.ts`)
- [ ] Decide canonical home for each capability (recommend: keep `verifier-formal` + `isl-smt`, deprecate `formal-verification`)
- [ ] Migrate any unique logic from `formal-verification` into the canonical packages
- [ ] Remove or mark `formal-verification` as `private: true`
- **Acceptance:** No duplicate SMT/formal verification code paths; single import path for consumers

**Estimated effort:** 2–3 days  
**Dependencies:** None  

---

## Milestone 1: Expression Evaluator 60% → 95% (Foundation)

**Package:** `packages/verifier-runtime`  
**Key file:** `src/evaluator.ts` (40 KB)

The expression evaluator is the backbone of all runtime verification. Every postcondition, invariant, and precondition check flows through it. Completing it unlocks the pipeline, PBT, and trust score.

### 1.1 Arithmetic Operations
- [ ] Implement `+`, `-`, `*`, `/`, `%` for numeric binary expressions
- [ ] Handle integer vs decimal distinction
- [ ] Add overflow/underflow guards
- [ ] Add tests: `a + b == c`, `balance - amount >= 0`, `count * price`, `total / items`, `index % 2 == 0`
- **Acceptance:** All arithmetic binary ops evaluate to concrete values (not `'unknown'`)

### 1.2 String Operations
- [ ] Implement `contains(substring)` — `name.contains("admin")`
- [ ] Implement `startsWith(prefix)` / `endsWith(suffix)`
- [ ] Implement `length` property access for strings
- [ ] Implement string concatenation (`+` on strings)
- [ ] Implement `toUpperCase` / `toLowerCase` if referenced in specs
- [ ] Add tests for each operation
- **Acceptance:** String predicates evaluate to `true`/`false` against real values

### 1.3 Collection / Array Operations
- [ ] Implement index access: `items[0]`, `accounts[i]`
- [ ] Implement `length` for arrays/collections
- [ ] Implement `sum(collection.field)` aggregation
- [ ] Implement `count()` / `size()`
- [ ] Implement `contains(element)` for collections
- [ ] Implement `isEmpty` / `isNotEmpty`
- **Acceptance:** `sum(Account.balance) == old(sum(Account.balance))` evaluates concretely

### 1.4 Enhanced Member Expression Evaluation
- [ ] Nested member access: `result.session.user.id`
- [ ] Optional chaining semantics: `user?.profile?.avatar`
- [ ] Method-like predicates on nested objects: `result.email.is_valid`
- [ ] `old()` expressions with deep property paths
- **Acceptance:** Expressions like `Account.lookup(from).balance` resolve through context

### 1.5 Error Diagnostics
- [ ] When evaluation falls back to `'unknown'`, include the reason (missing context key, unsupported op, type mismatch)
- [ ] Add source location (line:col) to evaluation errors
- [ ] Structured diagnostic codes for evaluator failures (e.g., `EVAL_001: unknown_property`)
- [ ] Log which sub-expression caused the `unknown` fallback
- **Acceptance:** Every `'unknown'` result carries a machine-readable reason string

### 1.6 Test Coverage Push
- [ ] Extend `tests/v1-evaluator.test.ts` with arithmetic, string, and collection cases
- [ ] Add edge cases: null values, empty strings, empty arrays, division by zero
- [ ] Add postcondition evaluation tests for `old()` + arithmetic combos
- [ ] Target: 500+ test cases total (currently ~399)
- **Acceptance:** `pnpm --filter @isl-lang/verifier-runtime test` passes with >95% coverage on evaluator

**Estimated effort:** 5–7 days  
**Dependencies:** M0  

---

## Milestone 2: SMT Integration 30% → 60%

**Packages:** `packages/isl-smt`, `packages/verifier-formal`  
**Goal:** The verify pipeline produces real `proved`/`disproved` verdicts instead of `unknown` for well-formed specifications.

### 2.1 Expression Encoder Completeness
- [ ] **Null literal encoding:** Encode ISL `null` as SMT option type or sentinel value
- [ ] **Complex member expressions:** Encode `User.lookup(email).status` as uninterpreted functions with axioms
- [ ] **String constraints:** Encode `email.is_valid`, `length >= N` as SMT string theory constraints
- [ ] **Enum/union encoding:** Encode `UserStatus` enums as finite domain sorts
- [ ] **Quantifier encoding:** Translate ISL `all` / `any` to SMT `forall` / `exists`
- [ ] **`old()` encoding:** Encode pre-state vs post-state as separate variable sets (e.g., `balance_pre`, `balance_post`)
- [ ] Add encoder unit tests for every new encoding
- **Acceptance:** `encodeExpression()` handles all expression types found in `corpus/*.isl` files without fallback to `unknown`

### 2.2 Wire SMT Checker into Verify Pipeline
- [ ] In `isl-verify-pipeline/src/stages/`, implement real `smt_checker` stage (currently returns `unknown`)
- [ ] When postcondition evaluator returns `'unknown'`, pass the clause to `isl-smt` for resolution
- [ ] Feed solver verdict + evidence back into the pipeline's `ClauseResult`
- [ ] Handle timeout gracefully: if solver times out, mark clause as `unknown` with `smt_timeout` category
- [ ] Wire `resolveUnknown()` from `isl-smt` into the pipeline's unknown-resolution flow
- **Acceptance:** `runVerification()` with SMT enabled resolves at least 50% of previously-unknown clauses to `proved`

### 2.3 External Solver Reliability
- [ ] Fix external solver (Z3) to not return `unknown` for satisfiable simple integer constraints
- [ ] Add retry logic for solver process crashes
- [ ] Implement solver result validation (parse SMT-LIB output correctly on all platforms)
- [ ] Test on Windows (z3.exe), macOS, Linux
- [ ] Add integration test that runs Z3 on a real ISL-derived query
- **Acceptance:** `checkSatExternal()` returns `sat`/`unsat` for all queries that the builtin solver handles

### 2.4 CVC5 Support
- [ ] Complete CVC5 binary detection (currently stubbed in `external-solver.ts`)
- [ ] Validate CVC5 output parsing (may differ from Z3 format)
- [ ] Add CVC5-specific integration tests
- [ ] Update `getSolverAvailability()` to include CVC5 status
- **Acceptance:** `isCVC5Available()` works; `solve()` with `solver: 'cvc5'` produces correct results

### 2.5 Proof Evidence Pipeline
- [ ] Attach `SolverEvidence` to every SMT-resolved clause in the proof bundle
- [ ] Include SMT-LIB query hash for reproducibility
- [ ] Store counterexample models when verdict is `disproved`
- [ ] Write SMT evidence into proof bundle's `results/` directory
- **Acceptance:** Proof bundles contain solver evidence for every SMT-checked clause

**Estimated effort:** 7–10 days  
**Dependencies:** M0, M1 (evaluator improvements reduce unknowns before SMT is needed)  

---

## Milestone 3: Property-Based Testing — Production Ready

**Package:** `packages/isl-pbt`  
**Goal:** PBT can be run against any ISL behavior with `isl pbt <spec>` and produces actionable results.

### 3.1 Generator Completeness
- [ ] Add generator for `Money` / `Decimal` types with precision constraints
- [ ] Add generator for `DateRange` dependent types (`end > start`)
- [ ] Add generator for ISL enum types (auto-derived from `enum` declarations)
- [ ] Add generator for collection/array types with size constraints
- [ ] Add generator for nested entity types (e.g., `User` with `Address`)
- **Acceptance:** `createInputGenerator()` handles all types in `stdlib-auth`, `stdlib-payments`, and `stdlib-uploads`

### 3.2 Postcondition Property Verification
- [ ] After execution, automatically verify all `postconditions` from the ISL spec
- [ ] Use the expression evaluator (M1) to check postcondition expressions against actual results
- [ ] Report which postconditions passed/failed/unknown per test run
- [ ] Include postcondition results in `PBTReport`
- **Acceptance:** `runPBT()` report includes per-postcondition pass/fail stats

### 3.3 Invariant Verification Beyond PII
- [ ] Extend invariant checking beyond `never_logged` to general invariants
- [ ] Implement `sum(Account.balance) == old(sum(Account.balance))` style conservation checks
- [ ] Implement state machine invariants (lifecycle transitions)
- [ ] Report invariant violations with the specific values that broke the invariant
- **Acceptance:** PBT detects conservation-law violations (e.g., money creation in transfer)

### 3.4 Shrinking Improvements
- [ ] Precondition-aware shrinking for all generator types (not just login)
- [ ] Shrink nested records (shrink each field independently)
- [ ] Shrink arrays (remove elements, shrink remaining)
- [ ] Timeout guard on shrinking (max wall-clock time, not just iteration count)
- **Acceptance:** Shrunk inputs are 50%+ smaller than originals on average

### 3.5 CLI Integration
- [ ] `isl pbt <spec.isl>` command runs PBT for all behaviors in the spec
- [ ] `--behavior <name>` flag to target a specific behavior
- [ ] `--seed <N>` flag for reproducibility
- [ ] `--num-tests <N>` flag (default 100)
- [ ] JSON output mode for CI (`--format json`)
- [ ] Human-readable summary with pass/fail counts
- **Acceptance:** `isl pbt examples/auth.isl` runs and prints results

### 3.6 Fast-Check Interop (Optional)
- [ ] If user has `fast-check` installed, allow PBT to delegate to fast-check arbitraries
- [ ] Map ISL generators to fast-check arbitraries for users who prefer that ecosystem
- **Acceptance:** Optional — nice to have for ecosystem compatibility

**Estimated effort:** 5–7 days  
**Dependencies:** M0, M1 (for postcondition evaluation)  

---

## Milestone 4: Chaos Engineering — Production Ready

**Package:** `packages/verifier-chaos`  
**Goal:** Chaos scenarios defined in ISL specs are executable and produce verifiable results.

### 4.1 ISL Chaos Scenario Parser Integration
- [ ] Ensure `parseChaosScenarios()` handles all ISL `chaos` block syntax from the language spec
- [ ] Support `inject { database_failure(...) }`, `inject { network_timeout(...) }`, etc.
- [ ] Parse assertion blocks: `(A and B) or (C and D)` disjunctive postconditions
- [ ] Validate scenario references (entities, behaviors) exist in the domain
- **Acceptance:** All `chaos` blocks in `corpus/*.isl` parse without errors

### 4.2 Injector Completeness
Current injectors: network, database, latency, concurrent, rate-limit, idempotency.

- [ ] **Service dependency injector:** Simulate external service failures (e.g., payment gateway down)
- [ ] **Clock skew injector:** Simulate time drift for temporal property testing
- [ ] **Memory pressure injector:** Simulate OOM conditions
- [ ] **Partial failure injector:** Only N% of requests fail (probabilistic)
- **Acceptance:** Every `inject` type in the ISL language spec has a corresponding injector

### 4.3 Chaos Execution Engine
- [ ] Wire chaos executor into the verify pipeline as an optional stage
- [ ] Execute `given` → `inject` → `when` → `then` flow
- [ ] Capture timeline of events during chaos execution
- [ ] Support parallel chaos scenario execution
- [ ] Implement rollback/cleanup after each scenario
- **Acceptance:** `verify()` with chaos enabled runs scenarios and reports pass/fail

### 4.4 Chaos Reporting
- [ ] Generate chaos test report with scenario-level pass/fail
- [ ] Include timeline visualization data (JSON format for rendering)
- [ ] Report which injector was active when a failure occurred
- [ ] Include chaos results in the proof bundle
- [ ] Calculate chaos coverage: % of failure modes tested
- **Acceptance:** Chaos report included in proof bundle under `results/chaos-report.json`

### 4.5 CLI Integration
- [ ] `isl chaos <spec.isl>` command runs all chaos scenarios
- [ ] `--scenario <name>` flag to target a specific scenario
- [ ] `--dry-run` flag to parse and validate without executing
- [ ] JSON output for CI
- **Acceptance:** `isl chaos examples/payments.isl` runs and prints results

**Estimated effort:** 5–7 days  
**Dependencies:** M0, M1  

---

## Milestone 5: Trust Score System

**Goal:** Every verification run produces a 0–100 trust score summarizing overall confidence.

The language spec defines this:
```
Trust Score: 94/100
  Preconditions:  12/12 passed
  Postconditions: 18/18 passed
  Invariants:     5/5 maintained
  Temporal:       3/3 satisfied
  Chaos:          8/10 passed
  Coverage:       97%
```

### 5.1 Score Calculation Engine
- [ ] Create `packages/trust-score` (or add to `isl-verify-pipeline`)
- [ ] Define scoring weights:
  - Preconditions: 15%
  - Postconditions: 30%
  - Invariants: 20%
  - Temporal properties: 10%
  - Chaos resilience: 15%
  - Code coverage: 10%
- [ ] `unknown` results penalize score (partial credit, not zero)
- [ ] Configurable weights via `.islrc.json`
- **Acceptance:** `calculateTrustScore(verificationResult)` returns 0–100

### 5.2 Per-Component Scores
- [ ] Break down score by category (preconditions, postconditions, invariants, temporal, chaos, coverage)
- [ ] Break down by behavior (each behavior gets its own trust score)
- [ ] Break down by domain (aggregate of behavior scores)
- **Acceptance:** Trust score report shows per-category and per-behavior breakdown

### 5.3 Score Thresholds & Gates
- [ ] Define configurable pass/fail thresholds (e.g., `minTrustScore: 80`)
- [ ] `isl gate` command enforces trust score threshold
- [ ] CI integration: fail the build if trust score drops below threshold
- [ ] Support score delta: warn if score decreased from last run
- **Acceptance:** `isl gate --min-score 80` exits 1 if score < 80

### 5.4 Score History & Trends
- [ ] Store trust scores in `.isl/scores/` directory (one JSON per run)
- [ ] `isl score history` command shows score over time
- [ ] Detect regressions: warn if score dropped by >5 points
- **Acceptance:** Score history is persisted and queryable

**Estimated effort:** 3–5 days  
**Dependencies:** M1, M2, M3, M4 (needs all verifiers feeding results)  

---

## Milestone 6: Test Generation 40% → 80%

**Packages:** `packages/codegen-tests`, `packages/test-generator`  
**Goal:** `isl codegen --tests` generates runnable test files, not just stubs.

### 6.1 Precondition Violation Tests
- [ ] For each precondition, generate a test with an input that violates it
- [ ] Auto-generate invalid values: invalid email formats, passwords too short, negative amounts
- [ ] Assert that the implementation rejects the invalid input (returns error, throws, etc.)
- **Acceptance:** Generated tests for `email.is_valid` use actual invalid emails like `"not-an-email"`

### 6.2 Postcondition Assertion Tests
- [ ] For each postcondition, generate a test that executes with valid input and asserts the postcondition
- [ ] Use the expression evaluator to generate assertion code
- [ ] Support `old()` assertions by capturing state before and after
- **Acceptance:** Generated tests include real assertions, not `// TODO: Implement test`

### 6.3 Idempotency Test Generation
- [ ] For behaviors with `idempotency_key`, generate duplicate-request tests
- [ ] Assert that duplicate requests return same result
- [ ] Assert that side effects are not duplicated
- **Acceptance:** Idempotency tests are runnable (not scaffold-only)

### 6.4 Webhook / Event Test Generation
- [ ] For behaviors that emit events/webhooks, generate listener tests
- [ ] Assert event payload matches spec
- [ ] Generate replay protection tests (duplicate event handling)
- **Acceptance:** Webhook tests verify payload structure and replay safety

### 6.5 Integration Test Generation
- [ ] Generate multi-behavior integration tests (e.g., CreateUser → Login → UpdateProfile)
- [ ] Use scenario blocks from ISL specs as test templates
- [ ] Generate setup/teardown code for test databases
- **Acceptance:** Integration tests exercise full behavior chains

### 6.6 Test Runtime Harness
- [ ] Complete `isl-test-runtime` package with mock adapters for database, email, etc.
- [ ] Provide `createTestContext()` that wires up mocks matching the ISL spec's effect declarations
- [ ] Auto-generate mock implementations from ISL entity definitions
- **Acceptance:** Generated tests run without manual mock setup

**Estimated effort:** 5–7 days  
**Dependencies:** M0, M1  

---

## Milestone 7: Temporal Verification Polish

**Package:** `packages/verifier-temporal`  
**Goal:** Temporal properties (`response within 200ms`, `eventually within 5min`) are verified against real execution traces.

### 7.1 Trace Collection Integration
- [ ] Define standard trace format for temporal verification
- [ ] Collect timestamps at behavior entry/exit points
- [ ] Collect timestamps for async events (email sent, webhook delivered)
- **Acceptance:** Traces include nanosecond-precision timestamps for all events

### 7.2 Response Time Verification
- [ ] Verify `response within X.ms (p99)` against collected traces
- [ ] Calculate percentile distributions (p50, p95, p99)
- [ ] Report violations with actual vs expected latency
- **Acceptance:** `verifyTemporal()` reports latency SLA violations

### 7.3 Eventually Properties
- [ ] Verify `eventually within X.minutes: event_happened` against trace timelines
- [ ] Support compound eventually: `eventually: A or B`
- [ ] Report timeout violations (event never happened within window)
- **Acceptance:** Eventually properties checked against real trace data

### 7.4 Always/Never Properties
- [ ] Verify `always { condition }` holds at every trace point
- [ ] Verify `never { condition }` is not true at any trace point
- [ ] Report first violation point in the trace
- **Acceptance:** Always/never properties checked across full trace

### 7.5 Temporal Results in Pipeline
- [ ] Wire temporal verifier into the verify pipeline
- [ ] Include temporal results in trust score calculation
- [ ] Include temporal evidence in proof bundles
- **Acceptance:** Temporal properties appear in `VerificationResult.clauseResults`

**Estimated effort:** 4–5 days  
**Dependencies:** M0, M1  

---

## Milestone 8: End-to-End Integration & Polish

**Goal:** All verification components work together seamlessly through the pipeline.

### 8.1 Unified Verify Pipeline
- [ ] Ensure all stages run in sequence: parse → test_runner → trace_collector → postcondition_evaluator → invariant_checker → temporal_checker → chaos_runner → smt_checker → trust_score → proof_bundle
- [ ] Each stage can be individually enabled/disabled via config
- [ ] Pipeline produces a single `VerificationResult` with all components
- **Acceptance:** `isl verify spec.isl --all` runs full pipeline end-to-end

### 8.2 CLI Commands Audit
Ensure all verification CLI commands work:
- [ ] `isl verify <spec>` — full pipeline
- [ ] `isl verify <spec> --smt` — with SMT enabled
- [ ] `isl pbt <spec>` — property-based testing
- [ ] `isl chaos <spec>` — chaos engineering
- [ ] `isl gate <spec> --min-score 80` — gate check with trust score
- [ ] `isl proof create <spec>` — generate proof bundle
- [ ] `isl proof verify <bundle>` — verify proof bundle
- **Acceptance:** All commands documented in `--help` and functional

### 8.3 Cross-Package Integration Tests
- [ ] Add integration tests that exercise: parser → evaluator → SMT → pipeline → proof bundle
- [ ] Test with real corpus files (`corpus/*.isl`)
- [ ] Test with stdlib domains (auth, payments, uploads)
- [ ] Test error paths: malformed specs, solver unavailable, timeout
- **Acceptance:** Integration test suite in `tests/integration/` passes

### 8.4 Documentation
- [ ] Update `docs/HOW_IT_WORKS.md` with Phase 3 verification flow
- [ ] Document the trust score system
- [ ] Document PBT workflow with examples
- [ ] Document chaos testing workflow
- [ ] Add "Verification Deep Dive" doc
- **Acceptance:** All Phase 3 features have user-facing documentation

### 8.5 Performance Benchmarks
- [ ] Benchmark verify pipeline on small spec (<10 behaviors): target <5s
- [ ] Benchmark verify pipeline on medium spec (10–50 behaviors): target <30s
- [ ] Benchmark SMT solving: target <2s per clause average
- [ ] Benchmark PBT: target 100 iterations in <10s
- [ ] Add benchmarks to `bench/` directory
- **Acceptance:** Performance targets met; benchmarks in CI

**Estimated effort:** 4–5 days  
**Dependencies:** M0–M7  

---

## Execution Order & Dependency Graph

```
M0: Unblock Build (2-3 days)
 │
 ├── M1: Expression Evaluator (5-7 days)
 │    │
 │    ├── M2: SMT Integration (7-10 days)
 │    │
 │    ├── M3: PBT Production Ready (5-7 days)
 │    │
 │    ├── M4: Chaos Engineering (5-7 days)
 │    │
 │    ├── M6: Test Generation (5-7 days)
 │    │
 │    └── M7: Temporal Verification (4-5 days)
 │
 ├── M5: Trust Score (3-5 days) ← needs M1-M4, M7
 │
 └── M8: Integration & Polish (4-5 days) ← needs M0-M7
```

### Recommended Work Order

| Order | Milestone | Calendar Estimate | Parallelizable With |
|-------|-----------|-------------------|---------------------|
| 1 | M0: Unblock Build | Days 1–3 | — |
| 2 | M1: Expression Evaluator | Days 4–10 | — |
| 3 | M2: SMT Integration | Days 11–20 | M3, M6, M7 |
| 4 | M3: PBT Production Ready | Days 11–17 | M2, M6, M7 |
| 5 | M6: Test Generation | Days 11–17 | M2, M3, M7 |
| 6 | M7: Temporal Verification | Days 11–15 | M2, M3, M6 |
| 7 | M4: Chaos Engineering | Days 18–24 | M5 |
| 8 | M5: Trust Score | Days 21–25 | M4 |
| 9 | M8: Integration & Polish | Days 26–30 | — |

**Total estimated effort:** 40–55 days (single developer), ~25–30 days with parallelization.

---

## Success Criteria for Phase 3 Complete

| Metric | Current | Target |
|--------|---------|--------|
| Expression eval coverage | ~60% | ≥95% |
| SMT integration | ~30% (returns `unknown`) | ≥60% (real verdicts) |
| PBT | ~75% (core working) | 100% (CLI, all types, postconditions) |
| Chaos engineering | ~70% (injectors built) | 100% (pipeline integrated, CLI) |
| Test generation | ~40% (stubs) | ≥80% (runnable tests) |
| Temporal verification | ~65% | ≥90% (pipeline integrated) |
| Trust score | 0% | 100% (calculation + gates + history) |
| Proof bundles | ~90% | 100% (all evidence types included) |
| Cross-package integration tests | 0% | ≥10 integration test scenarios |
| Build | FAILING | PASSING |

**Phase 3 is complete when:**
1. `pnpm build && pnpm test` is green
2. `isl verify examples/auth.isl` produces a trust score ≥80 with real verdicts
3. `isl pbt examples/auth.isl` runs 100 iterations and reports results
4. `isl chaos examples/payments.isl` executes chaos scenarios
5. Proof bundles contain SMT evidence, PBT results, chaos results, and temporal evidence
6. Trust score system is functional with configurable gates

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Z3 not available on all dev machines | SMT tests fail | Builtin solver fallback; skip external solver tests if Z3 absent |
| Expression evaluator `unknown` cascade | Pipeline never says `proved` | M1 is highest priority after build fix |
| `formal-verification` / `verifier-formal` confusion | Developer confusion, duplicated work | M0.4 consolidation task |
| Chaos tests are slow (network timeouts) | CI too slow | Mock-based chaos testing by default; real network tests opt-in |
| Scope creep into Phase 4 (AI) | Phase 3 never ships | Hard boundary: no AI/LLM features in Phase 3 |

---

*Last updated: 2026-02-07*
