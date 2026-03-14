# ShipGate Soundness Statement

**Version:** 1.0
**Status:** Living document
**Last updated:** 2026-03-02
**Audience:** Security engineers, formal methods researchers, and teams evaluating verification guarantees
**Companion document:** [Safety Specification](./SAFETY_SPECIFICATION.md)

---

## Table of Contents

1. [Definitions](#1-definitions)
2. [Per-Property Soundness Classification](#2-per-property-soundness-classification)
3. [Theoretical Limits](#3-theoretical-limits)
4. [Empirical False Positive/Negative Rates](#4-empirical-false-positivenegative-rates)
5. [Comparison to Related Tools](#5-comparison-to-related-tools)
6. [Improvement Roadmap](#6-improvement-roadmap)
7. [Version History](#7-version-history)

---

## 1. Definitions

### Core Verification Properties

**Soundness (no false negatives).** A verification procedure is *sound* with respect to a property *P* if, whenever *P* is violated in the program, the procedure reports a violation.

Formally: if program *π* violates property *P*, then the verifier *V* reports `FAIL` for *P* on *π*.

∀π : ¬P(π) → V(π, P) = FAIL

A sound verifier never says "safe" when the program is unsafe. It may, however, report violations that do not exist (false positives). **Soundness is the property most critical for security tooling** — a sound scanner guarantees that if it says "no SQL injection," there is no SQL injection (of the kind it models).

**Completeness (no false positives).** A verification procedure is *complete* with respect to a property *P* if, whenever it reports a violation, the violation actually exists.

Formally: if the verifier reports `FAIL`, then *P* is actually violated.

∀π : V(π, P) = FAIL → ¬P(π)

A complete verifier never raises false alarms. However, it may miss real violations (false negatives). Completeness without soundness is dangerous for security tooling — it means every reported finding is real, but real vulnerabilities may be silently missed.

**Decidability.** A property *P* is *decidable* if there exists an algorithm that, for every program *π*, terminates in finite time and correctly determines whether *P(π)* holds.

Most nontrivial semantic properties of programs are undecidable (Rice's theorem). Practical verifiers handle this by:
- Restricting the class of programs or properties they analyze
- Over-approximating (sound but incomplete)
- Under-approximating (complete but unsound)
- Using heuristics (neither sound nor complete)

### Verification Tiers

ShipGate classifies each verification method into one of three tiers:

| Tier | Name | Definition | Assurance Level |
|------|------|-----------|-----------------|
| **Formal** | Mathematical proof | The property is proved or disproved via logical deduction or decision procedure (e.g., SMT solving). If the proof is correct and the formalization is faithful, the result is both sound and complete for the formalized property. | Highest. Subject to formalization fidelity. |
| **Static** | Syntactic/structural analysis | The property is checked via AST traversal, pattern matching, type checking, or dataflow analysis without executing the program. May be sound for a restricted class of programs (e.g., `tsc` is sound for TypeScript's type system), or heuristic. | Medium. Depends on analysis precision. |
| **Heuristic** | Best-effort pattern matching | The property is checked via regex, string matching, entropy analysis, or behavioral pattern detection. Neither sound nor complete. Designed for high precision (low false positives) at the cost of recall. | Lowest. Known blind spots. |

### Property Classifications

**Safety property.** A property that asserts "nothing bad happens." Formally, a safety property is a set of traces *S* such that every trace *not* in *S* has a finite prefix that is also not in *S*. Safety violations are finitely observable — a single bad state is sufficient evidence. All ten ShipGate properties (P1–P10) are safety properties.

**Liveness property.** A property that asserts "something good eventually happens" (e.g., every request eventually receives a response). Liveness properties cannot be refuted by a finite prefix. **ShipGate does not verify liveness properties.** Termination, eventual consistency, and progress guarantees are outside scope.

**Trace property.** A property defined over execution traces (sequences of program states). Every trace property can be decomposed into the intersection of a safety property and a liveness property (Alpern-Schneider decomposition, 1987). ShipGate's Tier 2 runtime verification examines finite trace prefixes, which suffices for safety properties but not liveness.

---

## 2. Per-Property Soundness Classification

The following table classifies each of the ten safety properties from the [Safety Specification](./SAFETY_SPECIFICATION.md). The **Soundness** and **Completeness** columns describe the *strongest claim* that can be made about the current implementation, not aspirational goals.

| Property | Soundness | Completeness | Decidability | Method | Notes |
|----------|-----------|-------------|--------------|--------|-------|
| **P1** Import Integrity | **Sound** for static imports. Unsound for dynamic `require(expr)` and `import(expr)`. | Incomplete — may flag barrel re-exports as unresolvable in edge cases. | **Decidable** for static import statements. Undecidable for computed import paths. | AST extraction + `package.json` resolution + optional npm registry check. | Levenshtein-based typo detection adds heuristic enrichment but does not affect core soundness. |
| **P2** Secret Non-Exposure | **Unsound (heuristic).** Known false negatives: base64-encoded secrets, secrets split across variables, environment variable fallback chains (`process.env.KEY \|\| "hardcoded"`), secrets in non-standard file types. | Mostly complete — low false positive rate due to conservative patterns and entropy thresholds (Shannon entropy > 4.5 bits/char, length > 20). | Undecidable in general (determining whether an arbitrary string is a secret requires semantic knowledge). Decidable for known-format patterns (`sk_live_*`, `ghp_*`, `AKIA*`, PEM headers). | Pattern matching + Shannon entropy + sensitive variable name detection. | The entropy threshold is calibrated to minimize false positives. Lowering it would catch more secrets but flag UUIDs, hashes, and random test data. |
| **P3** SQL Injection Safety | **Unsound (heuristic).** Sound *only* when: (a) all database access uses a detected ORM (Prisma, Drizzle, TypeORM, Knex), AND (b) no `$queryRaw`, `sql.raw()`, or string concatenation appears in query contexts. Otherwise heuristic. | Incomplete — ORM method calls (`.findMany()`, `.create()`) may be flagged if the ORM is not recognized. | Undecidable in general (requires solving the taint analysis problem across arbitrary call graphs). Decidable for direct concatenation patterns in a single expression. | ORM detection + pattern matching for unsafe SQL construction. | Known false negatives: cross-module taint (user input in file A flows to query in file B), helper functions that internally concatenate SQL, stored procedure injection, ORM edge cases (raw query escape hatches). |
| **P4** XSS Safety | **Unsound (heuristic).** Detects direct `innerHTML`, `dangerouslySetInnerHTML`, and `document.write()` usage. Does not perform taint tracking. | Mostly complete — React JSX is correctly treated as safe by default. | Undecidable in general. Decidable for direct assignment patterns. | Pattern matching for known XSS sink APIs. | Known false negatives: computed property names (`el[prop] = userInput` where `prop = "innerHTML"`), dynamic element creation (`document.createElement` + attribute injection), template engine injection in non-React frameworks, CSS injection via `style` attributes. |
| **P5** Auth Enforcement | **Conditionally sound.** Sound IF: (a) the ISL spec correctly and completely enumerates all protected routes, AND (b) Tier 2 runtime verification is enabled. Unsound at Tier 1 alone (middleware presence ≠ correct enforcement). | Incomplete at Tier 1 — custom auth patterns may not be recognized. Complete at Tier 2 for tested paths (HTTP response codes are ground truth). | Decidable at Tier 2 (runtime observation). Undecidable at Tier 1 (cannot statically determine middleware correctness in general). | Tier 1: static middleware detection. Tier 2: automated HTTP probing (unauthenticated, invalid-token, forbidden-role requests). | The conditional soundness is important: if the ISL spec omits a route, that route is never tested. Spec completeness is the user's responsibility. ShipGate cannot verify what it is not told to verify. |
| **P6** SSRF Safety | **Unsound (heuristic).** Detects direct `fetch(req.body.url)` / `axios.get(userInput)` patterns. | Mostly complete — conservative patterns yield low false positives. | Undecidable in general (URL construction may involve arbitrary computation). | Pattern matching for user-input-to-fetch flows. | Known false negatives: multi-step URL construction, URL stored in database and later fetched, redirect-chain SSRF (server follows redirects to internal endpoints), DNS rebinding. No internal network topology awareness (e.g., cloud metadata endpoints). |
| **P7** Dependency Safety | **Sound** relative to the advisory database at query time. If a CVE exists in the database and the installed version is in the affected range, it will be flagged. | Complete — no false positives for advisory-matched vulnerabilities (the advisory is authoritative). | Decidable (version range intersection against advisory database). | Dependency tree analysis + advisory database (npm audit, OSV). | Fundamental limitation: zero-day vulnerabilities, malicious packages not yet reported, and supply-chain attacks at the binary level have zero detection rate. Soundness is relative to the database, not to the actual set of all vulnerabilities. |
| **P8** Type Safety | **Sound** (delegated to `tsc --strict`). TypeScript's type system is sound for the properties it checks, with documented exceptions. | Complete for the TypeScript type system (if `tsc` reports no errors, the program is well-typed modulo known unsoundness points). | Decidable (TypeScript type checking terminates for all programs, though it can be exponential in pathological cases). | `tsc --noEmit --strict` + AST scan for escape hatches (`@ts-ignore`, `as any`, implicit `any`). | Subject to TypeScript compiler bugs. Known unsoundness in TypeScript itself: `any` casts, type assertions, `@ts-ignore`, bivariant function parameter checking, `enum` value widening. ShipGate mitigates by additionally flagging escape hatches. |
| **P9** Error Handling | **Unsound (heuristic).** Detects structural patterns (missing `try-catch`, empty `catch` blocks, floating promises). Cannot verify error handling *correctness*. | Incomplete — global error handlers (Express `app.use((err, ...))`, Next.js `error.tsx`) may not be recognized as covering specific routes. | Undecidable in general (whether error handling is "correct" depends on business requirements). Decidable for structural presence checks. | AST traversal for route handlers, try-catch quality analysis, promise chain inspection. | Known false negatives: error handling delegated to framework-level middleware registered at startup, custom error boundary patterns, error recovery via event emitters. Known limitation: cannot distinguish semantically correct error handling from technically present but inadequate handling. |
| **P10** Mock Detection | **Unsound (heuristic).** Detects common mock patterns (hardcoded `{ success: true }`, placeholder arrays, sequential IDs, TODO/FIXME markers). | Mostly complete — conservative confidence threshold (default 0.5) and test file allowlisting reduce false positives. | Undecidable in general (distinguishing "simple legitimate code" from "mock code" requires understanding programmer intent). | Behavior-based pattern detection with confidence scoring. | Known false negatives: dynamically constructed success objects (`const result = {}; result.success = true; return result;`), promise-wrapped mocks, mocks that query a real database but ignore results, sophisticated placeholder data that uses realistic-looking values. Precision validated against 40-fixture test suite (20 should-flag, 20 should-not-flag). |

### Soundness Summary

Of the ten properties:
- **2** have formal or delegated soundness guarantees (P7, P8)
- **1** has conditional soundness with runtime verification (P5 at Tier 2)
- **1** has soundness for a well-defined subset (P1 for static imports)
- **6** are heuristic with known false negatives (P2, P3, P4, P6, P9, P10)

**This means the majority of ShipGate's safety properties are best-effort.** A SHIP verdict does not constitute a proof of absence for most vulnerability classes. It constitutes evidence of absence for checked patterns, which is a weaker but still valuable claim.

---

## 3. Theoretical Limits

This section discusses fundamental results from computability theory and mathematical logic that constrain what *any* program analysis tool — including ShipGate — can achieve.

### Rice's Theorem

**Statement.** For any nontrivial semantic property of programs, there is no algorithm that decides whether an arbitrary program has that property. (Rice, 1953)

A property is "nontrivial" if some programs have it and some do not. A property is "semantic" if it depends on the program's behavior (input-output relation) rather than its syntactic structure.

**Consequence for ShipGate.** Properties like "this program never constructs an SQL query from unsanitized input" are semantic — they depend on the program's runtime behavior, not merely its source text. By Rice's theorem, no algorithm can decide this property for all programs.

ShipGate handles this in three ways:
1. **Syntactic approximation.** Instead of checking the semantic property ("no unsanitized input reaches a query"), we check a syntactic approximation ("no string concatenation appears in a query-position AST node"). This is decidable but neither sound nor complete for the semantic property.
2. **Restricting the program class.** For ORM-based projects that exclusively use parameterized query builders, the syntactic check closely approximates the semantic property. Soundness degrades as programs use more dynamic patterns.
3. **Multi-tier escalation.** Tier 2 runtime testing and Tier 3 property-based testing provide empirical evidence for the semantic property on exercised paths, without claiming decidability.

### The Halting Problem

**Statement.** There is no algorithm that determines, for an arbitrary program and input, whether the program terminates. (Turing, 1936)

**Consequence for ShipGate.** ShipGate cannot guarantee:
- That a verified program terminates on all inputs.
- That verification itself terminates in bounded time for all inputs. (In practice, ShipGate enforces timeouts on SMT solver invocations and runtime tests, converting non-termination into `unknown` verdicts.)
- That an infinite loop in application code is detected as a bug.

ShipGate does not verify termination or liveness properties. All ten safety properties are safety properties (bad things don't happen), not liveness properties (good things eventually happen).

### Gödel's Incompleteness Theorems

**Statement (informal).** Any consistent formal system powerful enough to express arithmetic contains true statements that cannot be proved within the system. (Gödel, 1931)

**Consequence for ShipGate.** Even if ShipGate's formal verification tier (SMT solving) were expanded to cover all properties:
- There would still exist true security properties of programs that the system cannot prove.
- The system cannot prove its own soundness from within (second incompleteness theorem).
- This is a theoretical ceiling, not a practical limitation for most engineering contexts. The properties ShipGate checks (pattern presence, type safety, query parameterization) are far simpler than the arithmetic statements Gödel's theorems concern.

In practice, the incompleteness that matters is not Gödelian but *engineering* incompleteness: the gap between the formalized property and the actual security property the user cares about.

### What This Means for ShipGate

| Guarantee Type | Achievability | ShipGate's Approach |
|---------------|---------------|---------------------|
| "No SQL injection in this program" (semantic) | **Provably unachievable** in general (Rice's theorem). | Approximate via syntactic patterns (heuristic), ORM detection (restricted program class), runtime testing (empirical). |
| "No string concatenation in query position" (syntactic) | **Decidable and achievable.** | P3 checks this precisely for recognized patterns. |
| "`tsc --strict` reports no errors" (compiler delegation) | **Decidable and achievable.** | P8 delegates to the TypeScript compiler. |
| "All advisories for installed packages are checked" (database lookup) | **Decidable and achievable.** | P7 performs version range intersection. |
| "The program never leaks secrets" (semantic) | **Provably unachievable** in general. | Approximate via pattern + entropy (heuristic). |
| "This program terminates" | **Provably unachievable** in general (halting problem). | Not attempted. |

### The Soundness/Completeness Tradeoff

For undecidable properties, any practical verifier must choose a point on the soundness-completeness spectrum:

```
Sound + Incomplete                    Unsound + Complete
(catches everything, many             (no false alarms, misses
 false alarms)                         real bugs)
←─────────────────────────────────────→
```

- **Making ShipGate stricter** (e.g., flagging all `fetch()` calls as potential SSRF) improves soundness but increases false positives, reducing developer trust and adoption.
- **Making ShipGate more permissive** (e.g., only flagging `fetch(req.body.url)` exactly) improves completeness but increases false negatives, missing real vulnerabilities.

ShipGate's design philosophy is to **favor completeness (low false positives) at the cost of soundness** for heuristic properties. The rationale: in a CI gate context, false positives block deployments and erode developer trust. A tool that cries wolf is quickly disabled. We accept known false negative rates (documented per-property in Section 4) and mitigate them through multi-tier verification and defense-in-depth with complementary tools.

This is a deliberate engineering tradeoff, not an oversight. For the two properties where soundness is achievable (P7, P8), we maintain it.

---

## 4. Empirical False Positive/Negative Rates

The following table reports estimated error rates for each scanner. Estimates are based on internal precision test fixtures where available, and on structural analysis of detection methods where empirical data is not yet available.

### Scanner Error Rate Estimates

| Scanner | Est. False Positive Rate | Est. False Negative Rate | Basis |
|---------|------------------------|-------------------------|-------|
| **P1** Phantom Dependency Scanner | < 1% | < 1% for static imports; ~5% for dynamic imports | Validated against workspace resolution. Dynamic imports are not scanned. |
| **P2** Secret Exposure Prover | < 3% | 5–15% | Entropy threshold (4.5 bits/char) calibrated against UUID/hash false positive fixtures. FN rate estimated from known gap analysis (base64, split strings). |
| **P3** SQL Injection Prover | < 2% | 5–10% for ORM projects; 15–25% for raw SQL projects | ORM detection reduces FP. FN rate for raw SQL estimated from taint analysis coverage gap. |
| **P4** XSS Scanner | < 2% | 10–20% | React JSX whitelisting prevents most FP. FN rate reflects lack of taint tracking. |
| **P5** Auth Enforcement (Tier 1) | < 5% | 10–20% | Custom auth patterns cause both FP (non-standard middleware flagged) and FN (non-standard middleware missed). |
| **P5** Auth Enforcement (Tier 2) | < 1% | < 1% for spec-covered routes | Runtime HTTP probing is ground truth. FN rate reflects spec completeness, not scanner accuracy. |
| **P6** SSRF Scanner | < 2% | 15–25% | Conservative patterns yield low FP. High FN due to no taint tracking and no redirect-chain analysis. |
| **P7** Dependency Analyzer | 0% | 0% for known CVEs; 100% for zero-days | Advisory database is authoritative. FP is definitionally impossible (if the advisory exists, the vulnerability is real). FN for unknown vulnerabilities is total. |
| **P8** Type Safety Prover | 0% | 0% (modulo `tsc` bugs) | Delegated to TypeScript compiler. Escape hatch detection (`as any`, `@ts-ignore`) adds heuristic layer with ~1% FP. |
| **P9** Error Handling Prover | < 3% | 5–10% | FP from global error handlers not recognized. FN from framework-specific patterns. |
| **P10** Mock Detector | < 5% | 10–15% | Validated against 40-fixture precision suite. Highest FP risk among all scanners due to inherent ambiguity. |

### Aggregate System Rates

For a typical TypeScript/Next.js project using Prisma ORM:

| Metric | Estimated Rate |
|--------|---------------|
| **Per-finding false positive rate** | < 3% |
| **Per-finding false negative rate** | 5–15% (varies by property) |
| **Probability of a SHIP verdict on a program with ≥1 real vulnerability** | ~10–20% (depends on vulnerability type) |
| **Probability of a NO_SHIP verdict on a clean program** | < 2% |

The asymmetry is intentional: ShipGate is tuned to avoid blocking clean code (low false positive) at the cost of occasionally passing vulnerable code (moderate false negative). This is why ShipGate recommends complementary tools for defense in depth.

### Benchmark Status

The `bench/detection-benchmarks` package contains structured test fixtures for systematic evaluation of detection accuracy across vulnerability categories:

| Category | Fixture Count | Status |
|----------|--------------|--------|
| SQL Injection | 5 fixtures | Pending benchmark suite completion |
| XSS | 4 fixtures | Pending benchmark suite completion |
| SSRF | 2 fixtures | Pending benchmark suite completion |
| Secrets | 4 fixtures | Pending benchmark suite completion |

Once the benchmark suite is complete, the estimated rates in this section will be replaced with measured rates. Until then, treat all rates as engineering estimates subject to revision.

---

## 5. Comparison to Related Tools

### Soundness Properties of Related Tools

| Tool | Approach | Soundness | Completeness | Speed | Formal Proofs |
|------|----------|-----------|-------------|-------|---------------|
| **Semgrep** | Pattern-based with intraprocedural taint tracking. Rules are user-defined YAML patterns matched against ASTs. | **Neither sound nor complete.** Patterns catch what they are written to catch. No guarantee of coverage. Intraprocedural taint is a strict subset of full taint analysis. | Mostly complete for matched patterns — Semgrep rules are precise and rarely produce false positives when well-written. | Very fast (sub-second for most scans). | None. |
| **CodeQL** | Dataflow-aware query language. Builds a relational database from the program, then evaluates Datalog-like queries. Interprocedural taint tracking. | **Closer to sound** for supported query patterns. Interprocedural dataflow analysis catches flows that pattern-based tools miss. Still limited by query coverage and language modeling fidelity. | Less complete than Semgrep — interprocedural analysis can produce false positives from infeasible paths. | Slow (minutes to hours for large codebases). Database construction is expensive. | None. |
| **Snyk Code** | ML-assisted analysis. Combines symbolic analysis with machine learning models trained on vulnerability patterns. | **Unknown formal properties.** ML models do not provide formal soundness guarantees. Good empirical recall on known vulnerability patterns. | Unknown. ML models may produce false positives on unfamiliar code patterns. | Fast (cloud-based analysis). | None. |
| **TypeScript Compiler (`tsc`)** | Hindley-Milner-inspired type inference with structural subtyping. | **Sound for TypeScript's type system** (with documented exceptions: `any`, type assertions, bivariant parameters). | Complete (if `tsc` accepts a program, the program is well-typed within TypeScript's model). | Fast. | The type checker itself is a proof system for type safety. |
| **Z3 / CVC5 (SMT Solvers)** | Decision procedures for satisfiability modulo theories (linear arithmetic, bitvectors, arrays, uninterpreted functions). | **Sound and complete** for decidable theories. May return `unknown` for undecidable fragments (quantified formulas, nonlinear arithmetic). | See soundness. | Varies (milliseconds to timeout). | Yes — proofs are machine-checkable. |
| **ShipGate** | Multi-tier: heuristic pattern matching (Tier 1) + runtime HTTP probing (Tier 2) + PBT/mutation testing (Tier 3) + SMT solving (formal subset). | **Mixed.** Sound for P7 (advisory DB), P8 (delegated to `tsc`), P5 Tier 2 (runtime). Heuristic for P2, P3, P4, P6, P9, P10. | Low false positive rate by design. Completeness prioritized over soundness for heuristic properties. | Tier 1: < 10s. Tier 2: 30–60s. Tier 3: 2–10 min. | Yes, for SMT-backed properties. Proof bundles provide cryptographic attestation of verification results. |

### What ShipGate Adds Beyond Traditional SAST

1. **AI-specific detectors.** Mock detection (P10) and hallucinated import detection (P1) address failure modes unique to AI-generated code. No other tool in this comparison checks for these.

2. **Specification-driven verification.** ISL specs declare intended behavior as machine-checkable contracts. Verification is against the specification, not solely against generic vulnerability patterns. This enables per-project, per-endpoint property checking rather than one-size-fits-all rules.

3. **Proof bundles with cryptographic attestation.** Verification results are packaged into signed bundles containing evidence, evaluation tables, solver traces, and timestamps. These support audit workflows (SOC 2, ISO 27001) and provide a tamper-evident record of what was verified.

4. **Trust scoring with evidence decay.** A weighted, multi-signal trust score aggregates evidence across tiers. Evidence decays over time (configurable half-life), preventing stale verification from maintaining artificially high confidence. No other tool in this comparison implements evidence-age-aware scoring.

5. **Unified multi-tier verification.** Static analysis, runtime behavioral testing, property-based testing, mutation testing, and formal SMT verification are orchestrated under a single pipeline with a single verdict. Competing approaches require assembling separate tool chains.

### What ShipGate Lacks Relative to Competitors

1. **Interprocedural taint tracking.** Semgrep (intraprocedural), CodeQL (interprocedural), and Snyk Code (ML-assisted) all perform taint analysis that ShipGate does not. This is the single largest capability gap for injection vulnerability detection (P3, P4, P6).

2. **Broad language support.** Semgrep: 30+ languages. CodeQL: 10+. ShipGate: TypeScript/JavaScript only. Polyglot codebases have no ShipGate coverage for non-JS components.

3. **Community rule ecosystem.** Semgrep has thousands of community-contributed rules covering OWASP Top 10, CWE patterns, and framework-specific checks. ShipGate's detection patterns are internally maintained.

4. **Infrastructure and container scanning.** Snyk and GitHub Advanced Security cover container images, IaC templates (Terraform, CloudFormation), and license compliance. ShipGate operates at the source code level only.

---

## 6. Improvement Roadmap

The following improvements are planned or in progress. Each is tied to specific property soundness upgrades.

### Phase 2: Taint Tracking

**Target properties:** P3 (SQL Injection), P4 (XSS), P6 (SSRF)
**Current tier:** Heuristic (pattern matching)
**Target tier:** Static analysis with intraprocedural taint tracking

Intraprocedural taint tracking traces data flow from *sources* (user input: `req.body`, `req.query`, `req.params`) to *sinks* (SQL queries, DOM manipulation, HTTP requests) within a single function. This upgrades P3, P4, and P6 from "detects direct patterns" to "detects data flows within a function scope."

**Remaining gap after Phase 2:** Cross-function and cross-file taint flows will still require manual review or complementary tools.

**Expected impact on error rates:**
- P3 FN rate: 5–10% → 2–5% (for single-file flows)
- P4 FN rate: 10–20% → 5–10%
- P6 FN rate: 15–25% → 8–15%

### Phase 3: Z3 WASM Formal Verification

**Target properties:** ISL postcondition verification, constraint satisfiability
**Current state:** Z3 integration exists (`@isl-lang/isl-smt`) but requires native Z3 binary
**Target state:** Z3 compiled to WASM for browser and CI environments without native dependencies

Formal verification via SMT solving provides mathematical proofs for properties expressible in supported theories (linear arithmetic, bitvectors, arrays). This does not replace heuristic scanning for P2–P10 but provides a formal tier for ISL-specified postconditions and invariants.

**Expected impact:** Properties expressed as ISL postconditions that fall within decidable SMT theories can be formally proved or disproved, achieving soundness and completeness for those specific formalized properties.

### Phase 3b: PBT Exhaustive Mode

**Target:** Runtime-level soundness for exercised paths
**Current state:** PBT runs 100 random inputs per endpoint (standard mode)
**Target state:** Exhaustive mode with configurable iteration count, coverage-guided input generation, and shrinking

With sufficient iterations, PBT provides probabilistic soundness: the probability of missing a bug that occurs in >*k*% of inputs decreases exponentially with iteration count. This is not formal soundness, but it provides quantifiable confidence bounds.

**Expected impact:** For endpoints with Tier 3 PBT coverage, the probability of an undetected behavioral violation on random inputs drops below configurable thresholds (e.g., < 0.1% with 1000 iterations for bugs occurring in > 1% of inputs).

### Phase 4: Continuous Runtime Monitoring

**Target:** Production-time violation detection
**Current state:** Verification is a build-time gate (pre-deployment)
**Target state:** Runtime contract monitors in production that detect violations of ISL-specified invariants on live traffic

Continuous monitoring catches violations that static analysis misses by observing actual production behavior. This is complementary to build-time verification: static analysis prevents known-bad patterns from deploying; runtime monitoring catches violations that emerge only under real-world conditions.

**Expected impact:** Properties that are heuristic at build time (P2, P3, P4, P6) can be monitored at runtime with higher confidence, though at the cost of detecting violations *after* they occur rather than preventing them.

### Summary of Planned Tier Upgrades

| Property | Current Tier | After Phase 2 | After Phase 3 | After Phase 4 |
|----------|-------------|---------------|---------------|---------------|
| P1 | Static (sound for subset) | — | — | — |
| P2 | Heuristic | — | — | Runtime monitoring |
| P3 | Heuristic | Static (intraprocedural taint) | — | Runtime monitoring |
| P4 | Heuristic | Static (intraprocedural taint) | — | Runtime monitoring |
| P5 | Static + Runtime | — | — | Continuous auth monitoring |
| P6 | Heuristic | Static (intraprocedural taint) | — | Runtime monitoring |
| P7 | Static (sound) | — | — | — |
| P8 | Static (sound, delegated) | — | — | — |
| P9 | Heuristic | — | — | Runtime error rate monitoring |
| P10 | Heuristic | — | — | — |

---

## 7. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-02 | Initial soundness statement. Per-property classification, theoretical limits, empirical rate estimates, tool comparison, improvement roadmap. |

Future versions will update this document as:
- Detection benchmarks (`bench/detection-benchmarks`) produce measured error rates to replace estimates
- Taint tracking (Phase 2) upgrades P3/P4/P6 soundness classification
- Z3 WASM (Phase 3) enables formal verification tier for additional properties
- Runtime monitoring (Phase 4) adds continuous verification layer

---

## Appendix: Reading This Document

**If you are a security engineer evaluating ShipGate for adoption:** Focus on Section 2 (per-property classification) and Section 4 (error rates). The soundness column in Section 2 tells you exactly what each property can and cannot guarantee. The error rate table tells you what to expect empirically.

**If you are a formal methods researcher:** Section 3 (theoretical limits) discusses the computability-theoretic constraints. Section 2's decidability column classifies each property. The key insight is that ShipGate operates primarily in the heuristic and static tiers, with formal verification available for the subset of properties expressible in SMT-decidable theories.

**If you are building on top of ShipGate:** The soundness/completeness tradeoff (Section 3) explains the design philosophy. ShipGate favors low false positives over soundness for heuristic properties. If your use case requires soundness guarantees, restrict to P7 (dependency safety), P8 (type safety), and P5 Tier 2 (runtime auth verification), and treat all other properties as defense-in-depth layers, not proof obligations.
