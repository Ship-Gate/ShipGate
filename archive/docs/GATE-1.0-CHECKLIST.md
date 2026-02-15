# ISL 1.0 Gate Checklist

## Baseline Status (2026-02-02)

### Build Status
| Metric | Status | Notes |
|--------|--------|-------|
| Build (`pnpm build`) | FAILING | Missing deps (picocolors), TS errors in demos |
| Typecheck (`pnpm typecheck`) | FAILING | Blocked by isl-stdlib build |
| Tests (`pnpm test`) | FAILING | Blocked by playground build |

### Current Metrics (Estimated from Exploration)

| Area | Current | Target | Gap |
|------|---------|--------|-----|
| Expression eval coverage | ~60% | 95% | 35% |
| Semantic passes | 8 implemented | 8 verified | Need validation |
| Stdlib registered modules | 3 | 10 | 7 |
| Test generation completeness | ~40% | 80% | 40% |
| SMT/Z3 integration | ~30% | 60% | 30% |
| Non-TS codegens (Python) | Partial | Real | Incomplete |

---

## Blocking Issues (Must Fix First)

### P0: Build Blockers
1. [ ] Missing `picocolors` dependency in tsup
2. [ ] Missing `next` module in playground
3. [ ] TypeScript error: `ClickRipple` type in `AnimatedBackground.tsx`
4. [ ] `spec-assist` workspace not in lockfile

---

## Execution Order

### Phase A: Expression Evaluator (Coverage 60→95)
**Package:** `packages/isl-expression-evaluator`

Current features:
- [x] Tri-state logic (AND, OR, NOT, IMPLIES)
- [x] Literals (boolean, string, number, null)
- [x] Binary operators (==, !=, <, <=, >, >=)
- [x] Unary operators (-, !)
- [x] Property access (member expressions)
- [x] Function predicates (is_valid, length, exists, etc.)
- [x] Quantifiers (all, any)
- [x] Old expressions (for postconditions)

Missing for v1 complete:
- [ ] Arithmetic operations (+, -, *, /, %)
- [ ] String operations (contains, startsWith, endsWith)
- [ ] Index access for arrays/collections
- [ ] Better error diagnostics

**Test files:**
- `tests/v1-evaluator.test.ts` - 194 cases
- `tests/evaluator.test.ts` - 63 cases
- `tests/domain-adapter.test.ts` - 65 cases
- `tests/diagnostics.test.ts` - 32 cases
- `tests/postcondition-login.test.ts` - 45 cases

**Total:** ~399 test cases

---

### Phase B: Semantic Passes (Validate 8 Passes)
**Package:** `packages/isl-semantic-analysis`

Implemented passes:
1. [x] `unreachable-clauses` - Detects unreachable conditions
2. [x] `unused-symbols` - Detects unused declarations
3. [x] `enhanced-consistency-checker` - Contradictions, missing metadata
4. [x] `unsatisfiable-preconditions` - Never-satisfiable conditions
5. [x] `intent-coherence` - Intent declaration validation
6. [x] `type-coherence` - Type constraint validation
7. [x] `redundant-conditions` - Tautological/duplicate conditions
8. [x] `cyclic-dependencies` - Circular dependency detection

**Status:** All 8 passes implemented, need validation that all tests pass.

---

### Phase C: Stdlib Coverage (3→10 Modules)
**Package:** `packages/isl-stdlib`

Currently registered:
1. [x] `stdlib-auth` - Authentication/authorization
2. [x] `stdlib-payments` - Payment processing
3. [x] `stdlib-uploads` - File uploads

Need ISL definitions:
4. [ ] `stdlib-core` - Primitives, patterns
5. [ ] `stdlib-api` - REST/GraphQL definitions
6. [ ] `stdlib-events` - Event sourcing/CQRS
7. [ ] `stdlib-workflow` - State machines
8. [ ] `stdlib-queue` - Job processing
9. [ ] `stdlib-search` - Full-text search
10. [ ] `stdlib-observability` - Logs/metrics/traces

---

### Phase D: Test Generation (40→80)
**Packages:** `packages/test-generator`, `packages/codegen-tests`

Currently supports:
- [x] Precondition validation tests
- [x] Postcondition assertion tests
- [x] Domain strategies (auth, payments, uploads, webhooks)
- [x] Property-based tests (fast-check)
- [x] Scenario tests (Given-When-Then)
- [x] Chaos tests

Incomplete:
- [ ] Idempotency key handling (scaffold only)
- [ ] Webhook replay protection (scaffold only)
- [ ] Integration test generation (basic scaffold)
- [ ] Full postcondition assertions

---

### Phase E: SMT Integration (30→60)
**Packages:** `packages/isl-smt`, `packages/verifier-formal`

Working:
- [x] Z3 subprocess integration
- [x] SMT-LIB generation
- [x] Precondition satisfiability
- [x] Postcondition implication
- [x] Builtin solver fallback

Incomplete:
- [ ] SMT checker in verify-pipeline (returns `unknown`)
- [ ] External solver in prover (returns `unknown`)
- [ ] Null literal encoding
- [ ] Complex member expressions
- [ ] CVC5 support

---

### Phase F: Python Codegen (Partial→Real)
**Package:** `packages/codegen-python`

Working:
- [x] Pydantic model generation
- [x] FastAPI router generation
- [x] Service layer classes
- [x] Repository pattern
- [x] SQLAlchemy models

Incomplete:
- [ ] Test implementation (scaffolds with TODO)
- [ ] Invariant validation (placeholders)
- [ ] Migration generation (stubs)
- [ ] Django/Flask support (stubs)
- [ ] Authentication implementation

---

## Success Criteria for 1.0

1. **Build passes:** `pnpm build` exits 0
2. **Typecheck passes:** `pnpm typecheck` exits 0
3. **Tests pass:** `pnpm test` with >90% pass rate
4. **Core coverage:** Expression eval >90%, semantic passes 100%
5. **Stdlib:** 10 registered modules with tests
6. **Verification:** SMT integration functional (not mock)
7. **Portability:** Python codegen produces runnable code

---

## Progress Log

| Date | Action | Result |
|------|--------|--------|
| 2026-02-02 | Initial baseline | Build failing, 3 blockers identified |
