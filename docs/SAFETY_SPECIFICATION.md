# ShipGate Safety Specification

**Version:** 1.0.0
**Status:** Living document
**Last updated:** 2026-03-02
**Audience:** Security engineers, auditors, and teams evaluating ShipGate's verification guarantees

---

## Table of Contents

1. [Safety Properties](#1-safety-properties)
2. [Threat Model](#2-threat-model)
3. [Trusted Computing Base](#3-trusted-computing-base)
4. [Verification Tiers](#4-verification-tiers)
5. [Verdict Semantics](#5-verdict-semantics)
6. [Known Limitations](#6-known-limitations)
7. [Comparison to Related Systems](#7-comparison-to-related-systems)

---

## 1. Safety Properties

The SHIP verdict asserts that the following properties hold for the verified codebase. Each property has a formal identifier, a description of what is checked, the method used, and an honest assessment of soundness.

### P1: Import Integrity

| Attribute | Value |
|---|---|
| **ID** | `P1` |
| **Description** | All import statements resolve to real, installed packages. No hallucinated or phantom dependencies. |
| **Formal statement** | For every import `I` in source file `F`: `I` resolves to a module `M` such that `M ∈ node_modules ∪ workspace_packages ∪ builtin_modules`. |
| **Verification method** | Static analysis: AST-based import extraction, resolution against `package.json` dependency trees, optional npm registry existence check. |
| **Soundness level** | **Sound for declared imports.** If an import statement exists in a scanned file and the package is not in `package.json` or resolvable in `node_modules`, it will be flagged. Dynamic `require()` with computed strings and re-exports through barrel files may produce false negatives. |
| **Tier** | 1 (Static) |
| **Implementation** | `@isl-lang/phantom-dependency-scanner` — Levenshtein-based typo detection, workspace-aware resolution, cached registry checks (rate-limited, timeout-protected). |

### P2: Secret Non-Exposure

| Attribute | Value |
|---|---|
| **ID** | `P2` |
| **Description** | No hardcoded secrets (API keys, tokens, private keys, connection strings) appear in source code. |
| **Formal statement** | For every string literal `S` in source file `F`: `¬matches_secret_pattern(S) ∧ entropy(S) ≤ 4.5 bits/char` when `len(S) > 20`. For every assignment `V = S` where `V ∈ {password, secret, apiKey, token, privateKey, connectionString, ...}`: `S` references `process.env` or a config provider, not a literal. |
| **Verification method** | Pattern matching (known secret formats: `sk_live_*`, `ghp_*`, `AKIA*`, PEM headers) + Shannon entropy analysis + sensitive variable name detection + `.gitignore` verification for `.env` files + client-side exposure checks in Next.js. |
| **Soundness level** | **Heuristic.** Pattern matching catches known formats. Entropy analysis catches high-randomness strings. Secrets that resemble normal strings (low entropy, no known prefix) will not be detected. Obfuscated or encoded secrets (base64-wrapped, split across variables) are not reliably caught. |
| **Tier** | 1 (Static) |
| **Implementation** | `SecretExposureProver` in `@isl-lang/isl-verify`. PROVEN requires: 0 hardcoded secrets, `.env` gitignored, no client-side exposure, all `process.env` references documented in `.env.example`. |

### P3: SQL Injection Safety

| Attribute | Value |
|---|---|
| **ID** | `P3` |
| **Description** | No unsanitized user input flows into SQL query construction. |
| **Formal statement** | For every database query invocation `Q` in source file `F`: `Q` uses parameterized queries (`$1`, `$2`), ORM method calls (`findMany`, `create`), or tagged template literals with proper escaping. `¬∃ Q` such that `Q` contains string concatenation or unparameterized template literals with variable interpolation in query position. |
| **Verification method** | Static analysis: ORM detection (Prisma, Drizzle, TypeORM, Knex, pg, mysql2, MongoDB), pattern matching for unsafe SQL construction patterns (`$queryRaw` with template literals, `sql.raw()`, string concatenation in query contexts), MongoDB `$where` / unescaped `$regex` detection. |
| **Soundness level** | **Heuristic with high coverage for ORM-based projects.** If the project uses Prisma or Drizzle exclusively through their query builder APIs, false negatives are unlikely. Raw SQL construction through indirect function calls (e.g., a helper function that concatenates strings internally) may be missed. Stored procedures and database-side dynamic SQL are outside scope. |
| **Tier** | 1 (Static) |
| **Implementation** | `SQLInjectionProver` in `@isl-lang/isl-verify`. Detects ORM in use, scans for unsafe patterns, validates safe patterns. PROVEN requires: all DB access uses parameterized queries or ORM methods, 0 raw string concatenation in query contexts. |

### P4: XSS Safety

| Attribute | Value |
|---|---|
| **ID** | `P4` |
| **Description** | No unsanitized user input is rendered as HTML. |
| **Formal statement** | For every HTML rendering operation `R` in source file `F`: `R` uses framework-provided escaping (React JSX, template engine auto-escape) or explicit sanitization. `¬∃ R` such that `R` assigns user-controlled data to `innerHTML`, `dangerouslySetInnerHTML`, or `document.write()` without sanitization. |
| **Verification method** | Static analysis: pattern matching for `innerHTML` assignment, `dangerouslySetInnerHTML` usage, `document.write()` calls. Detection of sanitization library usage (DOMPurify, sanitize-html). Framework-aware: React JSX is considered safe by default. |
| **Soundness level** | **Heuristic.** Catches direct `innerHTML` and `dangerouslySetInnerHTML` usage. Does not perform taint tracking — if user input flows through multiple function calls before reaching a sink, it may not be detected. Server-side template injection in non-React frameworks has limited coverage. |
| **Tier** | 1 (Static) |
| **Implementation** | `@isl-lang/security-scanner` verification checks. |

### P5: Auth Enforcement

| Attribute | Value |
|---|---|
| **ID** | `P5` |
| **Description** | All routes declared as authenticated in the ISL spec actually enforce authentication at runtime. |
| **Formal statement** | For every route `R` where the ISL spec declares `requires auth`: (a) Static: middleware or guard referencing auth is present in the route handler chain. (b) Runtime: HTTP request to `R` without a valid token returns status `401`. HTTP request with an invalid token returns `401`. HTTP request with a valid token for an unauthorized role returns `403`. |
| **Verification method** | Tier 1: Static middleware detection. Tier 2: Runtime HTTP probing — the application is launched in test mode and unauthenticated/invalid requests are sent to protected endpoints, verifying rejection. |
| **Soundness level** | **Tier 1: Heuristic** (middleware presence does not guarantee correct enforcement). **Tier 2: Sound for tested paths** (actual HTTP requests prove behavior, but only for endpoints covered by the spec). |
| **Tier** | 1 (Static) + 2 (Runtime) |
| **Implementation** | Tier 1: Static auth coverage analysis. Tier 2: `RuntimeVerifier` in `@isl-lang/isl-verify` generates missing-auth, invalid-auth, and forbidden test cases per endpoint. PROVEN requires 100% auth test pass rate. |

### P6: SSRF Safety

| Attribute | Value |
|---|---|
| **ID** | `P6` |
| **Description** | No user-controlled URLs are used in server-side HTTP requests without validation. |
| **Formal statement** | For every server-side HTTP request `H` (via `fetch`, `axios`, `http.request`, etc.) in source file `F`: if the URL argument contains user-controlled input, a URL validation or allowlist check is applied before the request is made. |
| **Verification method** | Static analysis: pattern matching for `fetch(req.body.url)`, `axios.get(userInput)`, and similar patterns. Detection of URL validation (allowlist checks, URL parsing with origin validation). |
| **Soundness level** | **Heuristic.** Detects direct user-input-to-fetch patterns. Indirect flows (user input stored in database, later used in fetch) are not tracked. Internal network topology assumptions (e.g., metadata endpoints at `169.254.169.254`) are not validated. |
| **Tier** | 1 (Static) |
| **Implementation** | `@isl-lang/security-scanner` SSRF verification check (`packages/security-scanner/src/verification/checks/ssrf.ts`). |

### P7: Dependency Safety

| Attribute | Value |
|---|---|
| **ID** | `P7` |
| **Description** | No known critical or high-severity vulnerabilities in declared dependencies. |
| **Formal statement** | For every dependency `D@V` in `package.json` (direct and transitive): `¬∃ advisory A` in the vulnerability database where `A.severity ∈ {critical, high}` and `A.affected_range` includes `V`. |
| **Verification method** | Dependency tree analysis against vulnerability databases (npm audit, advisory databases). |
| **Soundness level** | **Complete for known vulnerabilities, zero coverage for unknown.** If a CVE exists in the database and the package version is in the affected range, it will be flagged. Zero-day vulnerabilities, malicious packages not yet reported, and supply chain attacks at the binary level are not detected. |
| **Tier** | 1 (Static) |
| **Implementation** | Dependency analysis via `@isl-lang/dependency-analyzer`. |

### P8: Type Safety

| Attribute | Value |
|---|---|
| **ID** | `P8` |
| **Description** | TypeScript strict mode compilation succeeds with no errors. |
| **Formal statement** | `tsc --noEmit --strict` exits with code `0`. Additionally: `count(@ts-ignore) = 0`, `count(as any) = 0`, all exported functions have explicit return type annotations. |
| **Verification method** | TypeScript compiler invocation (`tsc --noEmit --strict`) + AST scan for type escape hatches (`@ts-ignore`, `@ts-expect-error`, `as any` casts) + type coverage analysis (ratio of explicitly typed functions to total functions). |
| **Soundness level** | **Sound for TypeScript's type system.** TypeScript's type system is sound for the properties it checks (with known exceptions: `any` casts, type assertions, `@ts-ignore`). ShipGate's prover additionally flags these escape hatches. JavaScript projects are reported as NOT VERIFIED. |
| **Tier** | 1 (Static) |
| **Implementation** | `TypeSafetyProver` in `@isl-lang/isl-verify`. PROVEN requires: `tsc --strict` passes, 0 implicit `any`, 0 `@ts-ignore`, all exported functions typed. PARTIAL if `tsc` passes but escape hatches exist. |

### P9: Error Handling

| Attribute | Value |
|---|---|
| **ID** | `P9` |
| **Description** | All async operations and route handlers have error handling. No stack traces leak to clients. |
| **Formal statement** | For every route handler `H`: `H` is wrapped in `try-catch` or uses error middleware. For every `catch` block `C`: `C` is not empty, does not only `console.log`, does not expose `error.stack` in HTTP responses. For every Promise chain `P`: `P` has a `.catch()` handler. For every `await` expression `A`: `A` is inside a `try` block. |
| **Verification method** | Static analysis: AST traversal for route handler patterns (Express, Fastify, Next.js), try-catch quality analysis, promise chain inspection, floating promise detection. |
| **Soundness level** | **Heuristic.** Detects structural error handling patterns. Cannot verify that error handling is semantically correct (e.g., that the right error is caught, or that recovery logic is appropriate). Global error handlers registered at application startup may not be detected as covering specific routes. |
| **Tier** | 1 (Static) |
| **Implementation** | `ErrorHandlingProver` in `@isl-lang/isl-verify`. PROVEN requires: all route handlers have meaningful error handling, no stack trace leaks, all promises have rejection handling, no floating promises. |

### P10: Mock Detection

| Attribute | Value |
|---|---|
| **ID** | `P10` |
| **Description** | No hardcoded success responses, placeholder data, or mock behavior in production code paths. |
| **Formal statement** | For every non-test source file `F` (where `F ∉ {test/*, mock/*, fixture/*, stories/*}`): `¬∃` patterns matching hardcoded success (`return { success: true }` without conditionals), placeholder arrays (sentinel values: "placeholder", "example", "test", "dummy"), sequential mock IDs, or TODO/FIXME comments indicating fake data. |
| **Verification method** | Behavior-based pattern detection (not name-based). Automatic allowlisting of test, mock, fixture, and story files. Confidence scoring per finding. |
| **Soundness level** | **Heuristic.** Detects common mock patterns with a precision test suite (20 should-flag, 20 should-not-flag fixtures). Sophisticated mocks that mimic real behavior patterns will not be caught. The detector is deliberately conservative to avoid flagging legitimate code that happens to return simple success objects. |
| **Tier** | 1 (Static) |
| **Implementation** | `@isl-lang/mock-detector`. Behavior-based scanning with configurable confidence threshold (default 0.5), custom pattern support, claim graph integration. |

### Summary Table

| Property | ID | Tier | Method | Soundness |
|---|---|---|---|---|
| Import Integrity | P1 | 1 | Static analysis + registry | Sound for declared imports |
| Secret Non-Exposure | P2 | 1 | Pattern + entropy | Heuristic |
| SQL Injection Safety | P3 | 1 | ORM detection + pattern | Heuristic (high coverage with ORM) |
| XSS Safety | P4 | 1 | Pattern matching | Heuristic |
| Auth Enforcement | P5 | 1+2 | Static + runtime HTTP probing | Heuristic (T1), Sound for tested paths (T2) |
| SSRF Safety | P6 | 1 | Pattern matching | Heuristic |
| Dependency Safety | P7 | 1 | Advisory database lookup | Complete for known vulns |
| Type Safety | P8 | 1 | TypeScript compiler | Sound (TypeScript's guarantees) |
| Error Handling | P9 | 1 | AST analysis | Heuristic |
| Mock Detection | P10 | 1 | Behavior-based patterns | Heuristic |

---

## 2. Threat Model

### Adversary Model

ShipGate defends against an **AI coding assistant that generates code with honest intent but imperfect knowledge.** This is not a malicious adversary — it is a system that:

- Invents package names that do not exist (hallucinated imports)
- Copies security anti-patterns from training data (SQL concatenation, `innerHTML` assignment)
- Omits authentication middleware it was told to include
- Returns hardcoded success responses as placeholder implementations and forgets to replace them
- Leaks secrets by hardcoding them instead of using environment variables
- Generates code that type-checks in isolation but violates project conventions
- Introduces dependencies with known vulnerabilities because training data predates the advisory

This adversary model is distinct from a human attacker. ShipGate does not model intentional evasion.

### What ShipGate Defends Against

| Attack Vector | Coverage | Property |
|---|---|---|
| Hallucinated imports | Detected | P1 |
| Hardcoded secrets in source | Detected | P2 |
| SQL injection via string concatenation | Detected | P3 |
| XSS via `innerHTML` / `dangerouslySetInnerHTML` | Detected | P4 |
| Missing auth middleware | Detected (static + runtime) | P5 |
| Direct user-input-to-fetch SSRF | Detected | P6 |
| Known CVEs in dependencies | Detected | P7 |
| Type errors and `any` escape hatches | Detected | P8 |
| Missing error handling / stack trace leaks | Detected | P9 |
| Placeholder/mock code in production paths | Detected | P10 |

### What ShipGate Does NOT Defend Against

| Threat | Reason |
|---|---|
| **Adversarial code injection** | ShipGate does not model an attacker intentionally crafting code to evade detection. Pattern-based checks can be circumvented by a motivated adversary. |
| **Supply chain attacks at the binary level** | P7 checks for known CVEs but cannot detect malicious code injected into legitimate packages (e.g., event-stream attack). |
| **Logic errors in business rules** | Whether a discount calculation is correct, whether a state machine transitions are valid — these require domain-specific specifications that ShipGate cannot infer. |
| **Race conditions and concurrency bugs** | No temporal property verification is performed on concurrent code. TOCTOU, deadlocks, and data races are not detected. |
| **Performance and scalability issues** | N+1 queries, memory leaks, unbounded allocations, and algorithmic complexity are not analyzed. |
| **Indirect data flows** | Taint tracking across function boundaries, database storage, and retrieval is not implemented. A secret stored in a database and later logged would not be detected by P2. |
| **Infrastructure misconfigurations** | Misconfigured CORS, permissive firewall rules, unencrypted storage — these are outside the source code analysis boundary. |
| **Zero-day vulnerabilities** | P7 depends on advisory databases. Vulnerabilities not yet disclosed have zero detection rate. |
| **Non-TypeScript/JavaScript codebases** | Properties P1, P3, P4, P6, P8, P9 are implemented for TypeScript/JavaScript. Other languages have no coverage. |

### Honest Assessment

ShipGate is effective against the **most common failure modes of AI-generated code**: hallucinated dependencies, forgotten auth, hardcoded secrets, and injection vulnerabilities introduced through pattern copying. It is not a replacement for manual security review, penetration testing, or formal verification of business logic.

---

## 3. Trusted Computing Base (TCB)

The TCB is the set of components that must be correct for ShipGate's guarantees to hold. A bug in any TCB component could produce false negatives (missed vulnerabilities) or false positives (incorrect rejections).

### Core TCB Components

| Component | Package | Role | Failure Impact |
|---|---|---|---|
| **ISL Parser** | `@isl-lang/parser` | Parses ISL specs into ASTs. If parsing is incorrect, specifications may be misinterpreted. | Spec misinterpretation → wrong property checks. |
| **ISL Typechecker** | `@isl-lang/typechecker` | Semantic analysis of ISL specs. Resolves types, validates contracts. | Type errors in specs not caught → unsound verification. |
| **Gate Verdict Engine** | `@isl-lang/isl-gate` | Computes trust scores and SHIP/NO_SHIP decisions from evidence. | Incorrect scoring → wrong verdicts. |
| **Trust Score Calculator** | `@isl-lang/trust-score` | Multi-signal aggregation with weighted scoring. | Weight miscalibration → inflated or deflated scores. |
| **Verify Pipeline** | `@isl-lang/isl-verify-pipeline` | Orchestrates verification stages (test runner, trace collector, evaluator, SMT checker, proof bundle). | Pipeline ordering bugs → incomplete verification. |
| **Expression Evaluator** | `@isl-lang/isl-expression-evaluator` | Evaluates postcondition and invariant expressions with tri-state logic. | Evaluation bugs → false proofs or missed violations. |
| **SMT Solver Integration** | `@isl-lang/isl-smt` | Translates ISL constraints to SMT-LIB and invokes Z3/CVC5. | Translation bugs → unsound proofs. Timeout mishandling → zombie processes. |
| **Proof Checker** | `@isl-lang/isl-proof` | Validates proof bundles and claim graphs. | Proof acceptance bugs → invalid proofs accepted. |
| **Static Provers** | `@isl-lang/isl-verify` (provers) | `SecretExposureProver`, `SQLInjectionProver`, `ErrorHandlingProver`, `TypeSafetyProver` — pattern matching and analysis. | Pattern gaps → false negatives for that property. |
| **Security Scanner** | `@isl-lang/security-scanner` | XSS, SSRF, and additional security checks. | Pattern gaps → missed vulnerabilities. |
| **Mock Detector** | `@isl-lang/mock-detector` | Behavior-based mock/placeholder detection. | Pattern gaps → mock code shipped to production. |
| **Phantom Dependency Scanner** | `@isl-lang/phantom-dependency-scanner` | Import resolution and registry checks. | Resolution bugs → hallucinated imports not caught. |

### External Dependencies in the TCB

| Dependency | Role | Trust Basis |
|---|---|---|
| **TypeScript Compiler (`tsc`)** | P8 depends on `tsc --strict` correctness. | Microsoft-maintained, widely tested. TypeScript's type system has known unsoundness points (documented). |
| **Z3 Solver** | SMT verification (Tier 1 formal proofs). | Microsoft Research, peer-reviewed algorithms, extensively tested in academia and industry. |
| **CVC5 Solver** | Alternative SMT solver. | Stanford/Iowa, peer-reviewed, competition-winning solver. |
| **Node.js runtime** | All verification code executes on Node.js. | Broadly trusted, but runtime bugs could theoretically affect verification. |
| **npm registry** | P1 registry checks depend on npm's package existence API. | npm Inc., single point of truth for package existence. |
| **Advisory databases** | P7 depends on vulnerability databases (npm audit). | Community-reported, may have delays between disclosure and database entry. |

### TCB Size Estimate

| Component Category | Estimated Lines of Code |
|---|---|
| ISL Parser + Typechecker | ~8,000 |
| Gate + Trust Score | ~3,000 |
| Verify Pipeline + Evaluator | ~5,000 |
| Static Provers (4 provers) | ~4,000 |
| SMT Integration | ~3,000 |
| Security Scanner + Mock Detector | ~3,000 |
| Phantom Dependency Scanner | ~1,500 |
| Proof System | ~2,500 |
| **Total internal TCB** | **~30,000** |
| External (Z3, tsc, Node.js) | Not counted (third-party) |

A smaller TCB is generally preferable. 30,000 lines is substantial. We mitigate this through extensive test suites per component (each prover has 10-20+ test scenarios), property-based testing of the evaluator, and fuzzing of the parser.

---

## 4. Verification Tiers

ShipGate organizes verification into three tiers, each with different speed, depth, and assurance guarantees.

### Tier 1: Static Analysis

| Attribute | Value |
|---|---|
| **Method** | Pattern matching, AST analysis, TypeScript compiler, ORM detection, entropy analysis |
| **Speed** | < 10 seconds |
| **False negative rate** | Varies by property. Estimated 5-15% for heuristic checks (P2, P3, P4, P6, P9, P10). Near 0% for P1 (declared imports), P8 (tsc). |
| **False positive rate** | Low. Conservative patterns. Estimated < 3% for most properties. |
| **When to use** | Every commit, pre-commit hooks, CI on every PR. |

**Properties at Tier 1:** P1, P2, P3, P4, P5 (static component), P6, P7, P8, P9, P10.

All 10 safety properties have a Tier 1 static component. For most properties, this is the only verification performed.

### Tier 2: Runtime Verification

| Attribute | Value |
|---|---|
| **Method** | Application launch in test mode, automated HTTP request generation, response validation against ISL spec |
| **Speed** | 30-60 seconds (includes app startup) |
| **False negative rate** | 0% for tested paths. Endpoints not in the ISL spec are not tested. |
| **False positive rate** | Near 0%. Runtime tests are ground truth — if a request returns 200 when it should return 401, that is a real bug. |
| **When to use** | Pre-merge CI, nightly builds. |

**Properties at Tier 2:** P5 (runtime auth blocking), plus runtime input validation, response shape verification, and data leak detection.

Tier 2 launches the actual application, provisions a test database (SQLite), seeds test users, and sends HTTP requests to every endpoint defined in the ISL spec. This is the "Playwright for APIs" approach — it proves behavior, not just structure.

**Tier 2 produces four runtime property proofs:**
- `runtime-auth-blocking` — Unauthorized requests are rejected (401/403).
- `runtime-input-validation` — Malformed input returns 400, not 500.
- `runtime-response-shape` — Responses match declared types.
- `runtime-no-data-leak` — No sensitive fields (`password`, `passwordHash`, `secret`) in responses.

### Tier 3: Adversarial Testing

| Attribute | Value |
|---|---|
| **Method** | Property-based testing (randomized inputs), mutation testing (intentional code breakage) |
| **Speed** | 2-10 minutes depending on thoroughness |
| **False negative rate** | Probabilistic. With 100 random inputs per endpoint (standard mode), the probability of missing a bug that occurs in >5% of inputs is < 0.6%. Not sound. |
| **False positive rate** | Near 0%. If a property violation is found with a concrete counterexample, it is real. |
| **When to use** | PR reviews, release gates, security-sensitive changes. |

**Property-based testing invariants:**
- `valid_input_success` — Valid input never causes 500.
- `invalid_input_client_error` — Invalid input returns 4xx, never 500 or 2xx.
- `response_type_match` — Response shape matches declared type.
- `auth_enforced` — No random input bypasses authentication.
- `idempotency` — Same GET request returns same result.

**Mutation testing:**
- Security-critical mutations: `AUTH_REMOVAL`, `VALIDATION_REMOVAL`, `HASH_SKIP`, `PERMISSION_ESCALATE`.
- Standard mutations: `BOUNDARY_FLIP`, `ERROR_SWALLOW`, `RETURN_NULL`.
- PROVEN requires ≥80% overall mutation score AND ≥95% security mutation score.

### Tier Map

| Property | Tier 1 | Tier 2 | Tier 3 |
|---|---|---|---|
| P1: Import Integrity | Static resolution | — | — |
| P2: Secret Non-Exposure | Pattern + entropy | — | — |
| P3: SQL Injection Safety | ORM + pattern | — | PBT (input fuzzing) |
| P4: XSS Safety | Pattern matching | — | — |
| P5: Auth Enforcement | Middleware detection | Runtime HTTP probing | PBT (auth bypass attempts) |
| P6: SSRF Safety | Pattern matching | — | — |
| P7: Dependency Safety | Advisory lookup | — | — |
| P8: Type Safety | `tsc --strict` | — | — |
| P9: Error Handling | AST analysis | Runtime (500 detection) | Mutation (ERROR_SWALLOW) |
| P10: Mock Detection | Behavior patterns | — | — |

---

## 5. Verdict Semantics

### SHIP

**Meaning:** The verified codebase satisfies all critical safety properties at or above the configured thresholds.

**Formal condition:**

```
SHIP ⟺ trust_score ≥ 0.90
       ∧ confidence ≥ 0.60
       ∧ ¬∃ critical_failure
```

Where `critical_failure` is any of:
- A violated postcondition (`triStateResult = false`)
- An SMT counterexample found (`verdict = disproved`)
- A chaos invariant violation
- A critical static analysis error (e.g., hardcoded secret, SQL injection)
- A Tier 2 auth test failure (unauthorized request accepted)

**What SHIP does NOT mean:**
- The code is free of all bugs.
- Business logic is correct.
- The system will perform well under load.
- No undiscovered vulnerabilities exist.

SHIP means: "Given the properties we check, with the methods we use, at the tiers we ran, no violations were found and evidence confidence is high."

### NO_SHIP

**Meaning:** At least one critical safety property is violated, or the trust score is below the review threshold.

**Formal condition:**

```
NO_SHIP ⟺ trust_score < 0.70
          ∨ ∃ critical_failure
```

A NO_SHIP verdict is accompanied by:
- `trustReducers`: Specific factors that lowered the score, with severity and impact.
- `recommendations`: Actionable steps to resolve issues, with estimated impact on score.

### REVIEW_REQUIRED

**Meaning:** The trust score is in the ambiguous range — above the reject threshold but below the ship threshold.

**Formal condition:**

```
REVIEW_REQUIRED ⟺ 0.70 ≤ trust_score < 0.90
                  ∧ ¬∃ critical_failure
                  (OR confidence < 0.60 with trust_score ≥ 0.90)
```

This verdict indicates incomplete verification rather than detected violations. Common causes:
- Some postconditions could not be evaluated (`triStateResult = unknown`).
- Missing verification signals (e.g., no PBT results, no chaos testing).
- Low confidence due to sparse evidence.

### Trust Score Formula

The trust score is computed as a weighted sum of five verification signals:

```
trust_score = Σ (signal_weight_i × signal_score_i)
```

**Default weights:**

| Signal | Weight | Rationale |
|---|---|---|
| Evaluator Verdicts | 30% | Direct contract verification — the core signal. |
| SMT Proofs | 25% | Formal proofs provide the strongest guarantees. |
| PBT Results | 20% | Randomized testing catches edge cases missed by static analysis. |
| Static Checks | 15% | Fast feedback but less comprehensive than runtime evidence. |
| Chaos Outcomes | 10% | Resilience testing is important but optional for many systems. |

**Constraints:**
- No single signal can exceed `MAX_SINGLE_SIGNAL_WEIGHT` (default 40%), even if configured higher. This prevents a perfect score from a single verification method masking gaps in others.
- Weights are renormalized after capping.

**Penalties:**

| Condition | Penalty |
|---|---|
| Each `unknown` verdict | -0.15 |
| Each `fail` verdict | -0.25 |
| Missing signal category | -0.10 |
| Critical failure | ×2.0 multiplier on penalty |

**Evidence priority multipliers (when `enableEvidencePriority = true`):**
- SMT (formal verification): highest trust
- Runtime (test execution): medium trust
- Heuristic (static analysis): lowest trust (default)

**Time decay (when configured):**
- Evidence decays exponentially with a configurable half-life (default 90 days).
- Formula: `decay_multiplier = 2^(-age_days / half_life_days)`
- Older evidence contributes less. This prevents stale verification from maintaining artificially high scores.

### Critical Failure Conditions

The following conditions force a NO_SHIP verdict **regardless of trust score:**

1. **Violated postcondition** — An ISL postcondition evaluates to `false` with a concrete counterexample.
2. **SMT counterexample** — The SMT solver found an input that violates a declared constraint.
3. **Hardcoded secret detected** — P2 finds a secret pattern with high confidence.
4. **SQL injection pattern** — P3 finds unsafe query construction.
5. **Auth bypass** — Tier 2 runtime test shows an unauthenticated request was accepted on a protected route.
6. **Chaos invariant violation** — A system invariant broke under fault injection.

---

## 6. Known Limitations

### Fundamental Theoretical Limits

**Rice's Theorem.** It is impossible to decide arbitrary semantic properties of programs in general. ShipGate does not claim to verify arbitrary properties. Each property (P1-P10) is defined narrowly enough to be checkable by the specified method, but this means there are security-relevant properties that ShipGate simply cannot express or verify.

**Undecidability boundaries.** The following are undecidable in general and ShipGate does not attempt them:
- Whether a program terminates on all inputs.
- Whether two programs are semantically equivalent.
- Whether a program satisfies an arbitrary temporal logic formula.
- Whether a program correctly implements a business requirement expressed in natural language.

**SMT solver incompleteness.** SMT solvers are decision procedures for specific theories (linear arithmetic, bitvectors, arrays). For quantified formulas or nonlinear arithmetic, Z3 may return `unknown`. When this happens, the clause is marked `unknown` (not `proved` or `disproved`), and the trust score is penalized.

### Practical Limitations

**No taint tracking.** ShipGate does not perform interprocedural taint analysis. If user input flows through a series of function calls, is stored in a database, and later used in a SQL query, P3 will not detect the injection vulnerability. Each property check operates on local patterns within a file or function.

**No cross-file data flow analysis.** While import resolution (P1) is cross-file, security properties (P2-P6, P9-P10) operate primarily on single-file patterns. A secret defined in file A and imported in file B is not tracked.

**Language coverage.** Properties P1, P3, P4, P6, P8, P9 are implemented for **TypeScript and JavaScript only**. Python support is limited to the security scanner's SSRF checks. Go, Rust, Java, C#, and other languages have no coverage.

**Framework coverage.** ORM detection (P3) supports: Prisma, Drizzle, TypeORM, Knex, pg, mysql2, MongoDB. Route handler detection (P9) supports: Express, Fastify, Next.js App Router. Other ORMs and frameworks may have reduced detection rates.

**Concurrency.** No concurrency verification is performed. Race conditions, deadlocks, TOCTOU vulnerabilities, and atomicity violations are not detected by any property.

**Business logic.** ShipGate verifies structural and security properties. Whether a discount calculation is correct, whether a workflow state machine is complete, whether a permission model is sufficient — these require domain-specific specifications beyond ShipGate's scope.

### False Negative Expectations by Property

| Property | Expected False Negative Rate | Primary Gap |
|---|---|---|
| P1 | < 1% | Dynamic `require()` with computed strings |
| P2 | 5-15% | Low-entropy secrets, split/obfuscated secrets |
| P3 | 5-10% | Indirect SQL construction, raw query helpers |
| P4 | 10-20% | Indirect DOM manipulation, server-side template injection |
| P5 (T1) | 10-20% | Custom auth patterns, middleware ordering |
| P5 (T2) | < 1% for tested paths | Endpoints not in spec |
| P6 | 15-25% | Indirect URL construction, SSRF via redirects |
| P7 | ~0% for known CVEs | Zero-days, unreported vulns |
| P8 | ~0% | TypeScript compiler is the authority |
| P9 | 5-10% | Global error handlers, framework-specific patterns |
| P10 | 10-15% | Sophisticated mocks mimicking real behavior |

These estimates are based on internal precision testing fixtures and should be validated against your codebase.

### False Positive Expectations

ShipGate is tuned for low false positives. Each prover uses conservative patterns and confidence scoring. Expected false positive rate across all properties: < 3%. The mock detector (P10) has the highest false positive risk due to the inherent ambiguity between "simple code that returns a success object" and "mock code that returns a hardcoded success."

---

## 7. Comparison to Related Systems

### Feature Matrix

| Capability | ShipGate | Semgrep | CodeQL | Snyk Code | GitHub Advanced Security |
|---|---|---|---|---|---|
| **Custom specification language** | ISL specs define contracts per-domain | YAML rules | QL queries | — | — |
| **Taint tracking** | No (pattern-based) | Yes (intraprocedural) | Yes (interprocedural) | Yes (AI-assisted) | Yes (CodeQL) |
| **SMT formal verification** | Yes (Z3, CVC5) | No | No | No | No |
| **Property-based testing** | Yes (Tier 3) | No | No | No | No |
| **Mutation testing** | Yes (Tier 3) | No | No | No | No |
| **Runtime verification** | Yes (Tier 2) | No | No | No | No |
| **Trust score / confidence** | Yes (weighted multi-signal) | Per-finding confidence | Per-finding confidence | Per-finding confidence | Per-finding confidence |
| **SHIP/NO_SHIP gate** | Yes (CI-blocking verdict) | Exit code | Exit code | Exit code | Check status |
| **Proof bundles** | Yes (cryptographic) | No | No | No | No |
| **Secret detection** | Pattern + entropy | Semgrep Secrets | GitHub Secret Scanning | Yes | GitHub Secret Scanning |
| **Dependency scanning** | Advisory lookup | No (Semgrep Supply Chain is separate) | No | Yes (Snyk Open Source) | Dependabot |
| **AI-generated code focus** | Primary design target | General-purpose | General-purpose | General-purpose | General-purpose |
| **Mock/placeholder detection** | Yes | No | No | No | No |
| **Hallucinated import detection** | Yes | No | No | No | No |
| **Language support** | TypeScript/JavaScript | 30+ languages | 10+ languages | 10+ languages | 10+ languages |

### What ShipGate Adds

1. **AI-specific failure modes.** Mock detection (P10) and hallucinated import detection (P1) address failure modes unique to AI-generated code that traditional SAST tools do not check for.

2. **Specification-driven verification.** ISL specs declare intended behavior (preconditions, postconditions, invariants). Verification is against the specification, not just against generic vulnerability patterns.

3. **Multi-tier assurance.** A single tool provides static analysis (fast), runtime probing (medium), and adversarial testing (thorough), unified under one trust score rather than requiring separate tool chains.

4. **Formal verification integration.** SMT solver integration provides mathematical proofs for constraint satisfiability. No other commercial SAST tool integrates SMT solving.

5. **Proof bundles.** Cryptographically signed evidence bundles provide an auditable record of what was verified, when, and with what result. This supports compliance workflows (SOC 2, ISO 27001).

### What Those Tools Do That ShipGate Doesn't

1. **Taint tracking.** Semgrep, CodeQL, and Snyk Code all perform interprocedural taint analysis. This is their primary advantage for detecting injection vulnerabilities through indirect data flows. ShipGate's pattern-based approach will miss vulnerabilities that taint tracking would catch.

2. **Broad language support.** Semgrep supports 30+ languages, CodeQL 10+. ShipGate is TypeScript/JavaScript only. If your codebase includes Python backends, Go microservices, or Java services, those components have no ShipGate coverage.

3. **Community rule ecosystem.** Semgrep has thousands of community-contributed rules. CodeQL has extensive query libraries. ShipGate's detection patterns are maintained internally.

4. **IDE integration depth.** GitHub Advanced Security integrates natively with GitHub's PR workflow, code scanning alerts, and security overview dashboards. ShipGate's VS Code extension and GitHub Action provide integration but not at the same platform-native depth.

5. **Infrastructure scanning.** Snyk and GitHub Advanced Security cover container images, IaC templates, and license compliance. ShipGate operates only at the source code level.

### Recommendation

ShipGate is most valuable as a **complement to**, not a replacement for, traditional SAST tools. The recommended stack for comprehensive coverage:

- **ShipGate** — AI code safety gate, specification verification, formal proofs, runtime behavioral testing.
- **Semgrep or CodeQL** — Taint tracking, broad language coverage, community rules for known vulnerability patterns.
- **Dependabot or Snyk** — Dependency vulnerability monitoring with automated PRs.
- **GitHub Secret Scanning** — Continuous secret detection in git history (ShipGate only scans current source).

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **ISL** | Intent Specification Language — a domain-specific language for declaring behavioral contracts. |
| **SHIP** | Verdict indicating all critical properties pass and trust score ≥ 0.90. |
| **NO_SHIP** | Verdict indicating a critical failure or trust score < 0.70. |
| **Tri-state logic** | Evaluation logic with three values: `true`, `false`, `unknown`. Unknown is treated as "not proven" (fail-closed). |
| **Trust score** | Weighted aggregation of verification evidence, ∈ [0, 1]. |
| **Proof bundle** | Cryptographically signed artifact containing verification evidence, evaluation tables, and solver traces. |
| **TCB** | Trusted Computing Base — components that must be correct for guarantees to hold. |
| **PBT** | Property-Based Testing — randomized input generation to test invariants. |
| **SMT** | Satisfiability Modulo Theories — decision procedures for first-order logic with theory-specific solvers. |
| **Shadow spec** | An ISL specification inferred heuristically from source code when no explicit spec exists. |

## Appendix B: Version History

| Version | Date | Changes |
|---|---|---|
| 1.0.0 | 2026-03-02 | Initial specification. |
