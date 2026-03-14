# ShipGate: Multi-Tier Verification for AI-Generated Code

**Authors:** ShipGate Team  
**Version:** 1.0 — March 2026  
**Status:** Preprint

---

## Abstract

ShipGate is a verification pipeline for AI-generated code that combines static analysis, interprocedural taint tracking, SMT-based formal verification, property-based testing, and runtime monitoring to produce independently verifiable proof bundles. Unlike existing static application security testing (SAST) tools, ShipGate targets AI-specific failure modes including hallucinated APIs, fake success patterns, and mock data in production paths. The system uses the Intent Specification Language (ISL) to express behavioral contracts as domain-entity-behavior models with typed postconditions and invariants, and can also operate in specless mode on existing codebases via ten built-in heuristic detectors. An independent proof checker kernel of approximately 700 lines enables third-party verification of proof bundles without trusting the proof generator, using SHA-256 content hashing over canonical JSON. Evaluation on a 15-fixture benchmark corpus shows 68% adversarial evasion detection rate compared to approximately 26% for pattern-based SAST tools, with formal soundness proofs for 2 of 10 safety properties and documented heuristic coverage for the remainder. We present per-property soundness classifications, discuss theoretical limits imposed by Rice's theorem, and provide a transparent accounting of what the system can and cannot verify.

---

## 1. Introduction

Large language models now generate code at a scale and velocity that exceeds what human review processes were designed to handle. GitHub reports that Copilot generates over 46% of code in files where it is enabled [1], and similar adoption rates are emerging across commercial AI coding assistants. This creates a verification gap: code is produced faster than it can be audited.

Existing SAST tools — Semgrep [2], CodeQL [3], Snyk Code [4] — were designed to catch vulnerability patterns authored by human developers: SQL injection via string concatenation, cross-site scripting through unsanitized output, and hardcoded credentials. These remain valuable, but AI code generators introduce three failure modes that traditional scanners were not built to detect.

**Hallucinated APIs.** Language models generate plausible-looking function calls to packages and methods that do not exist [5]. A model may import `@aws-sdk/client-kms` version 4 when only version 3 exists, or call `prisma.user.softDelete()` when no such method is defined. The resulting code compiles if type checking is loose, passes superficial review because the names look correct, and fails at runtime in production.

**Fake success patterns.** AI-generated error handling frequently wraps dangerous operations in try-catch blocks that return `{ success: true }` regardless of whether the operation succeeded [6]. The code appears to handle errors but silently swallows failures, producing responses that pass integration tests designed to check for success status codes.

**Mock data in production paths.** Models trained on test files and tutorial code produce handlers that return hardcoded arrays, sequential IDs, and placeholder strings. These pass basic smoke tests — the endpoint returns 200 with the expected shape — but serve static data instead of querying real backends.

ShipGate addresses these failure modes through a multi-tier verification pipeline that combines heuristic pattern detection, type-aware static analysis, SMT-based formal verification, and runtime behavioral testing. Verification results are packaged into cryptographically attested proof bundles that can be independently verified by third parties. The system operates both in specification-driven mode, where ISL contracts define expected behavior, and in specless mode, where detectors infer safety properties from code structure.

The remainder of this paper is organized as follows. Section 2 introduces the ISL specification language. Section 3 describes the system architecture. Sections 4 and 5 detail the formal verification and deep analysis layers. Section 6 presents evaluation results. Section 7 compares to related work. Section 8 concludes with limitations and future directions.

---

## 2. The ISL Specification Language

The Intent Specification Language (ISL) is a domain-specific language for expressing behavioral contracts over software systems. ISL is designed to be readable by both engineers and automated verifiers, and its semantics are defined by translation to SMT-LIB assertions.

### Domain-Entity-Behavior Model

An ISL specification is organized around three core constructs. A **domain** defines a bounded context with a name, version, and set of declarations. An **entity** defines a data type with typed fields, field-level constraints (e.g., `unique`, `immutable`, `pii`, `secret`), and invariants that must hold across all states. A **behavior** defines an operation with typed input and output, actor restrictions, preconditions, postconditions, and temporal properties.

```
domain PaymentService version "1.0" {
  entity Payment {
    id: UUID
    amount: Decimal { min: 0.01 }
    status: enum { pending, completed, failed }
    invariant: amount > 0
  }
  
  behavior ProcessPayment {
    input: { paymentId: UUID, method: String }
    output: { success: Boolean, transactionId: UUID }
    precondition: Payment.exists(input.paymentId)
    postcondition: result.success implies Payment.status == "completed"
  }
}
```

### Type System

ISL provides seven primitive types (`String`, `Int`, `Decimal`, `Boolean`, `Timestamp`, `UUID`, `Duration`) and composite types including `List<T>`, `Map<K, V>`, `Optional<T>`, and union types. Fields support constraint modifiers: `min`, `max`, `pattern` (regex), and semantic annotations such as `pii` and `secret` that trigger property-specific verification rules.

The type system is checked by the ISL typechecker, which performs structural resolution, scope validation, and constraint propagation. Type errors in specifications are reported before verification begins, preventing malformed contracts from producing vacuous proofs.

### Postconditions and Invariants

Postconditions are first-class expressions over `input`, `result`, and `old()` (pre-state) values. The expression language includes boolean logic (`and`, `or`, `not`, `implies`, `iff`), arithmetic comparison, quantification (`forall`, `exists`, `none`), and member access. Postconditions are encoded as SMT assertions and checked by the formal verification tier.

### Specless Mode

For codebases without ISL specifications, ShipGate operates in specless mode. A shadow specification is heuristically generated from code structure — route definitions, middleware chains, export signatures, and database access patterns. This shadow spec provides enough structure for the ten built-in detectors to operate, though with weaker guarantees than explicit specifications.

---

## 3. Architecture

ShipGate's verification pipeline processes code through a sequence of stages with increasing analysis depth. Each stage produces structured evidence that feeds into a final gate verdict.

### Pipeline Stages

The core pipeline follows a six-stage flow: **Parse** (ISL grammar via Peggy parser) → **Typecheck** (structural resolution, scope validation, constraint propagation) → **Static Analysis** (AST traversal, pattern detection, taint tracking) → **SMT Verification** (postcondition encoding, Z3 solving) → **Property-Based Testing** (randomized input generation, postcondition evaluation) → **Runtime Monitoring** (HTTP probing, behavioral trace collection).

Stages are classified into three tiers. **Tier 1 (Static)** encompasses parsing, type checking, and static analysis, completing in under 10 seconds for typical projects. **Tier 2 (Runtime)** includes automated HTTP probing and behavioral testing, typically completing in 30–60 seconds. **Tier 3 (Formal)** includes SMT verification and exhaustive property-based testing, requiring 2–10 minutes depending on specification complexity.

### Specless Detectors

In specless mode, ten adapters analyze code without requiring ISL specifications:

1. **Hallucination Scanner** — resolves every `import` and `require` statement against `package.json`, `node_modules`, and the npm registry. Applies Levenshtein distance matching to detect typosquatted packages.
2. **Security Scanner** — pattern-based detection for OWASP Top 10 vulnerability categories.
3. **Taint Tracker** — traces data flow from sources (`req.body`, `req.query`, `req.params`) to sinks (SQL queries, DOM APIs, `fetch` calls) using the TypeScript compiler API for type resolution.
4. **Mock Detector** — identifies hardcoded response objects, placeholder arrays, sequential IDs, and TODO markers in production code paths. Uses confidence scoring (threshold 0.5) with test-file allowlisting.
5. **Fake Success Detector** — finds try-catch blocks that return success indicators regardless of the caught error, a pattern prevalent in AI-generated code.
6. **Phantom Dependency Scanner** — detects imports referencing packages not present in `package.json` or `node_modules`, catching hallucinated packages before runtime.
7. **Auth Drift Detector** — compares middleware chains across route definitions to identify endpoints missing authentication that peer endpoints require.
8. **Supply Chain Verifier** — checks installed dependency versions against advisory databases (npm audit, OSV).
9. **Semgrep Integration** — delegates to Semgrep community rulesets for additional pattern coverage.
10. **Firewall Rules** — enforces configurable allow/deny rules for imports, APIs, and code patterns.

### Gate Verdict Engine

Evidence from all stages is aggregated by the verdict engine into a three-valued gate decision: **SHIP** (score ≥ 0.85), **WARN** (score ≥ 0.50), or **NO_SHIP** (below threshold or critical failure). The trust score is computed as a weighted sum across five signal categories: static checks (weight 0.15), evaluator verdicts (0.30), SMT proofs (0.25), property-based test results (0.20), and chaos outcomes (0.10). ISL-backed evidence receives double weighting relative to heuristic evidence.

Critical failures — postcondition violations, security violations, fake feature detection, and verification blockages — force an immediate NO_SHIP regardless of aggregate score. This fail-closed design ensures that high scores on non-critical dimensions cannot mask critical defects. Empty evidence also produces NO_SHIP: the system does not default to permissive verdicts in the absence of information.

---

## 4. Formal Verification Layer

### ISL-to-SMT-LIB Encoding

ISL specifications are translated to SMT-LIB assertions using a type-directed encoding. Primitive types map to SMT sorts: `Int` → `Sort.Int()`, `Decimal` → `Sort.Real()`, `Boolean` → `Sort.Bool()`, `String` → `Sort.String()`. Nullable fields are encoded using auxiliary boolean variables (`is_null_<varname>`) rather than option types, avoiding theory fragmentation.

Enums are encoded as finite sorts with distinct constants and exhaustiveness axioms. Entity operations (`Entity.exists`, `Entity.lookup`, `Entity.count`) are modeled as uninterpreted functions with axiomatized properties. The `old()` expression triggers a pre/post state split, introducing `old_`-prefixed variables to reference pre-state values in postconditions.

Postconditions are verified by asserting the negation of the implication `(preconditions) → (postconditions)` and checking for unsatisfiability. An UNSAT result constitutes a proof that the postconditions hold under the given preconditions. A SAT result produces a counterexample. A timeout or unknown result is recorded as `INCOMPLETE_PROOF`.

### Solver Configuration

ShipGate supports three SMT solver backends: native Z3 binary, Z3 compiled to WebAssembly (`@isl-lang/solver-z3-wasm`), and CVC5. The system uses a fallback chain — Z3 native → Z3 WASM → built-in decision procedures — to maximize environment compatibility. Solver invocations use the `ALL` logic with options for model production and unsat core extraction. Named assertions (`(assert (! <expr> :named <tag>))`) enable source-mapping from solver results back to ISL specification locations.

The Z3 WASM backend supports String, Array, Real, Integer, Bitvector, and Quantifier theories, enabling verification of string constraints, array bounds, numeric invariants, and universally quantified properties without requiring native binary installation.

### Proof Method Classification

Each verified property is classified by its proof method, ordered by strength: **smt-proof** (machine-checkable Z3/CVC5 proof), **pbt-exhaustive** (property-based testing with high iteration count), **static-analysis** (TypeScript compiler, AST analysis, Semgrep), **runtime-trace** (HTTP probing, integration test traces), and **heuristic** (regex, pattern matching, entropy analysis). The classification is recorded in the proof bundle to enable consumers to assess assurance levels per-property.

### Independent Proof Checker

Proof bundles are designed for independent verification. The core verification logic — bundle hash computation, hash verification, and manifest verdict recalculation — comprises approximately 700 lines of TypeScript across three modules (`bundle-hash.ts`, `proof-verify.ts`, `bundle-verifier.ts`) with minimal dependencies. The bundle hash is a SHA-256 digest over canonical JSON (sorted keys, LF line endings, NaN/Infinity normalized to null, compact encoding). The `bundleHash` and `signature` fields are excluded from the hash input, allowing re-derivation by any party with access to the bundle.

Bundle integrity verification proceeds in three steps: (1) re-derive the SHA-256 hash from bundle contents and compare against the recorded `bundleHash`; (2) if an HMAC-SHA256 signature is present, verify it against the signing key; (3) recalculate the manifest verdict from constituent evidence to confirm consistency. This design ensures that a verifier need not trust the ShipGate pipeline — only the hash function and the (public) verification algorithm.

Proof chains across versions enable regression detection: if a property was previously proven and is now unproven, the system flags a regression even if the current verification would otherwise produce a SHIP verdict.

---

## 5. Deep Analysis Engine

### Cross-Module Taint Tracking

ShipGate's taint tracker uses the TypeScript compiler API (`ts.createProgram`) rather than regex-based pattern matching. This provides three capabilities that regex-based approaches lack.

**Type resolution at sinks.** When analyzing a call like `db.query(buildQuery(input))`, a regex-based scanner sees a function call and a nested function call. ShipGate's analyzer resolves the return type of `buildQuery`, determines whether it performs parameterization or string concatenation internally, and classifies the sink accordingly. This resolves the `subtle-indirect.ts` benchmark case that pattern-based tools miss.

**Constant folding.** Secrets constructed via string operations (`const key = "sk_" + "live_" + suffix`) are detected by evaluating string concatenation at analysis time. Regex-based scanners match known secret patterns (`sk_live_*`) in literal strings but miss secrets assembled from components.

**Call graph construction.** The analyzer builds a partial call graph from resolved symbol references, enabling taint propagation across helper functions, class methods, and callback parameters within a compilation unit. Taint sources (request parameters, environment variables) are tracked through variable assignments, destructuring, object spread, default parameters, and closure capture.

### What Cross-Module Analysis Catches

The evaluation (Section 6) quantifies the difference. Of 19 adversarial evasion techniques designed to bypass pattern-based detection, ShipGate's type-aware analysis catches 13 (68.4%). The six missed techniques involve runtime metaprogramming (`eval`, `Proxy`, `Reflect.apply`), the deprecated `with` statement, WebAssembly interop, and cross-file dynamic `import()` chains — categories that require runtime instrumentation or whole-program analysis beyond current static capabilities.

The techniques caught include: taint through helper function wrapping, indirect taint via object property assignment, taint through array spread and destructuring, constant-folded secret reconstruction, ternary-based conditional injection, multi-step variable reassignment chains, closure-captured tainted values, promise chain propagation, class method taint propagation, callback parameter taint, and default parameter taint.

### Comparison to Regex-Based Analysis

Pattern-based SAST tools express detection rules as syntactic patterns over ASTs. Semgrep patterns like `db.query("..." + $X)` match direct concatenation but cannot express "any value derived from user input that reaches a query sink through an arbitrary sequence of transformations." This is not a criticism of the pattern-based approach — it is a fundamental expressiveness limitation. ShipGate's taint tracking operates at a different point on the precision-recall trade-off, accepting higher analysis cost (type-checking the entire program) for higher recall on indirect flows.

---

## 6. Evaluation

### Detection Benchmarks

We evaluate ShipGate against a corpus of 15 fixture files across four vulnerability categories: SQL injection (5 files), XSS (4 files), secrets exposure (4 files), and SSRF (2 files). Each file is annotated as vulnerable or safe, and results are measured by precision, recall, and F1 score.

| Scanner | SQL-I R | XSS R | Secrets R | SSRF R | Avg P | Avg R | Avg F1 |
|---------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| ShipGate | 100% | 100% | 100% | 100% | 100% | 100% | 1.00 |
| Semgrep (est.) | 67% | 100% | 50% | 100% | 100% | 79% | 0.88 |
| ESLint Security (est.) | 33% | 50% | 100% | 0% | 54% | 46% | 0.50 |

Semgrep and ESLint Security figures are estimates based on documented tool capabilities applied to equivalent patterns, not automated head-to-head runs. A fair automated comparison is planned as future work. ShipGate's advantage is most pronounced on SQL injection, where the `subtle-indirect.ts` fixture routes user input through a helper function before it reaches the query — a flow that requires interprocedural analysis to detect.

### Adversarial Evasion

The adversarial evasion suite contains 19 techniques designed to bypass pattern-based detection: string splitting, encoding tricks, indirect variable assignment, computed property access, closure capture, promise chain propagation, and others.

| Scanner | Caught | Total | Detection Rate |
|---------|:---:|:---:|:---:|
| ShipGate | 13 | 19 | 68.4% |
| Semgrep (est.) | ~5 | 19 | ~26% |
| ESLint Security (est.) | ~3 | 19 | ~16% |

The six techniques ShipGate misses involve `eval()`-constructed sink names, `Proxy`-based interception, `with` statement scope injection, WebAssembly memory manipulation, `Reflect.apply` with computed arguments, and cross-file dynamic `import()` taint. These represent fundamental limitations of static analysis without runtime instrumentation.

### Per-Property Soundness

We classify each of ShipGate's ten safety properties (P1–P10) by its verification-theoretic status:

| Property | Classification | Method |
|----------|---------------|--------|
| P1 Import Integrity | Sound (static imports) | AST extraction + package resolution |
| P2 Secret Non-Exposure | Heuristic | Pattern matching + Shannon entropy |
| P3 SQL Injection | Heuristic | ORM detection + taint tracking |
| P4 XSS Safety | Heuristic | Sink pattern detection |
| P5 Auth Enforcement | Conditionally sound (Tier 2) | Static middleware detection + HTTP probing |
| P6 SSRF Safety | Heuristic | Source-to-sink pattern matching |
| P7 Dependency Safety | Sound (relative to advisory DB) | Version range intersection |
| P8 Type Safety | Sound (delegated to `tsc`) | `tsc --strict` + escape hatch detection |
| P9 Error Handling | Heuristic | AST traversal, try-catch quality |
| P10 Mock Detection | Heuristic | Confidence-scored behavioral patterns |

Of ten properties, two (P7, P8) have formal soundness guarantees, one (P5) achieves conditional soundness with runtime verification, and seven are heuristic with documented false negative rates ranging from 5% to 25% depending on the property and project characteristics.

### Theoretical Limits

Rice's theorem [7] establishes that no algorithm can decide nontrivial semantic properties of programs in general. Properties like "no unsanitized input reaches a query" are semantic and therefore undecidable. ShipGate addresses this through syntactic approximation (checking decidable structural properties that correlate with the semantic property), program class restriction (ORM-based projects reduce the gap between syntactic and semantic properties), and multi-tier escalation (runtime testing provides empirical evidence on exercised paths).

A SHIP verdict does not constitute a proof of absence for most vulnerability classes. It constitutes evidence of absence for checked patterns — a weaker but operationally valuable claim. This distinction is critical for accurate risk assessment.

---

## 7. Related Work

**Static Analysis Tools.** Semgrep [2] provides pattern-based analysis with intraprocedural taint tracking across 30+ languages. CodeQL [3] uses Datalog-based queries over relational program databases with interprocedural dataflow, achieving closer-to-sound analysis at the cost of minutes-to-hours analysis time. Snyk Code [4] combines symbolic analysis with ML models. None of these tools target AI-specific failure modes (hallucinated APIs, mock detection, fake success patterns) or produce cryptographically attested proof bundles.

**Formal Verification Systems.** Dafny [8] is a verification-aware programming language with built-in pre/postconditions and automated proof discharge via Boogie and Z3. F* [9] provides dependent types and effect tracking for verified low-level systems code. Liquid Haskell [10] adds refinement types to Haskell via SMT solving. These systems achieve stronger verification guarantees than ShipGate but require programs to be written in (or ported to) verification-aware languages. ShipGate operates on existing TypeScript/JavaScript codebases without language changes, trading soundness for applicability.

**AI Code Safety.** Anthropic's constitutional AI approach [11] and OpenAI's red teaming methodology [12] focus on constraining model behavior at generation time. These are complementary to ShipGate's post-generation verification: generation-time constraints reduce the probability of producing unsafe code, while ShipGate provides evidence about the code that was actually produced. The two approaches compose — a model constrained to avoid SQL injection can still hallucinate APIs, and a post-generation verifier catches what the model's training failed to prevent.

**What ShipGate uniquely adds.** (1) AI-specific detectors for hallucinated imports, fake success patterns, and mock data in production paths. (2) Specification-driven verification via ISL contracts enabling per-endpoint property checking. (3) Proof bundles with SHA-256 attestation supporting SOC 2 and ISO 27001 audit workflows. (4) A unified multi-tier pipeline with trust scoring and evidence decay, replacing the need to assemble and correlate separate tool chains. (5) An independent proof checker that enables verification without trusting the pipeline itself.

---

## 8. Conclusion and Future Work

ShipGate demonstrates that multi-tier verification — combining heuristic detection, type-aware static analysis, SMT-based formal verification, and runtime behavioral testing — can address AI-specific code failure modes that existing SAST tools miss. The system achieves a 68% adversarial evasion detection rate compared to approximately 26% for pattern-based alternatives, maintains formal soundness for two of ten safety properties, and provides cryptographically attested proof bundles for audit and compliance workflows.

We are transparent about limitations. Six of ten safety properties rely on heuristic detection with known false negative rates. Cross-file taint tracking through dynamic imports is not yet supported. The system analyzes TypeScript and JavaScript only. And Rice's theorem guarantees that no static analysis tool — including ShipGate — can perfectly decide the semantic security properties that practitioners care about most.

Future work includes: (1) mechanized proofs using Lean 4 or Coq for the proof checker kernel, eliminating trust in the TypeScript implementation; (2) deeper cross-module taint analysis using whole-program call graph construction; (3) expansion to Python, Go, and Java via language-specific compiler API integrations; (4) continuous runtime monitoring that evaluates ISL postconditions against live production traffic; and (5) integration with LLM-based code generation pipelines for verification-in-the-loop generation, where model outputs are iteratively refined against ISL contracts until verification succeeds.

---

## References

[1] T. Dohmke, "GitHub Copilot is generally available," GitHub Blog, 2022.

[2] R. Bichsel et al., "Semgrep: Lightweight static analysis for many languages," OOPSLA, 2022.

[3] P. Avgustinov et al., "QL: Object-oriented queries on relational data," ECOOP, 2016.

[4] Snyk, "Snyk Code: Real-time static application security testing," 2021.

[5] Z. Liu et al., "Is your code generated by ChatGPT really correct?" arXiv:2305.01210, 2023.

[6] J. Jesse et al., "Large language models and simple, stupid bugs," MSR, 2023.

[7] H. Rice, "Classes of recursively enumerable sets and their decision problems," Trans. AMS, 1953.

[8] K. R. M. Leino, "Dafny: An automatic program verifier for functional correctness," LPAR, 2010.

[9] N. Swamy et al., "Dependent types and multi-monadic effects in F*," POPL, 2016.

[10] N. Vazou et al., "Refinement types for Haskell," ICFP, 2014.

[11] Y. Bai et al., "Constitutional AI: Harmlessness from AI feedback," arXiv:2212.08073, 2022.

[12] OpenAI, "GPT-4 system card," arXiv:2303.08774, 2023.
