# ISL Healer Architecture

> **Self-healing pipeline: NL → ISL (locked) → code diff → gate → fix recipes → re-gate until SHIP (bounded)**

## 1. Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ISL Healer Pipeline                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                    │
│  │   NL Input   │────▶│  Translator  │────▶│  ISL Spec    │◀── LOCKED         │
│  │   (prompt)   │     │ @isl-lang/*  │     │  (frozen)    │    (immutable)    │
│  └──────────────┘     └──────────────┘     └──────┬───────┘                    │
│                                                    │                            │
│                                                    ▼                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         Code Generator                                    │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐       │  │
│  │  │ FrameworkAdapter│    │  CodeTemplates  │    │   DiffBuilder   │       │  │
│  │  │  (Next.js/etc)  │    │  (production)   │    │                 │       │  │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────┘       │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                    │                            │
│                                                    ▼                            │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                          HEALING LOOP (bounded)                           │  │
│  │  ┌────────────────────────────────────────────────────────────────────┐  │  │
│  │  │  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────┐ │  │  │
│  │  │  │  GateRunner│───▶│ Violations │───▶│ RuleMatcher│───▶│ Recipes│ │  │  │
│  │  │  │(JSON/SARIF)│    │ (by ruleId)│    │ (registry) │    │ Lookup │ │  │  │
│  │  │  └────────────┘    └────────────┘    └────────────┘    └───┬────┘ │  │  │
│  │  │                                                             │      │  │  │
│  │  │  ┌────────────┐    ┌────────────┐    ┌────────────┐        │      │  │  │
│  │  │  │  Validator │◀───│  Patcher   │◀───│FixRecipe   │◀───────┘      │  │  │
│  │  │  │(no-weaken) │    │ (AST/text) │    │(match+patch│               │  │  │
│  │  │  └─────┬──────┘    └────────────┘    └────────────┘               │  │  │
│  │  │        │                                                           │  │  │
│  │  │        ▼                                                           │  │  │
│  │  │  ┌────────────┐    ┌────────────┐                                 │  │  │
│  │  │  │ Iteration  │───▶│ Re-Gate    │──┐                              │  │  │
│  │  │  │ Recorder   │    │            │  │  ┌─ SHIP ────────────────┐   │  │  │
│  │  │  └────────────┘    └────────────┘  │  │                       │   │  │  │
│  │  │                                    │  │  ┌─ STUCK/UNKNOWN ──┐ │   │  │  │
│  │  │        ◀───── LOOP ◀─── NO_SHIP ◀──┤  │  │                  │ │   │  │  │
│  │  │                                    │  │  │  ┌─ MAX_ITER ──┐ │ │   │  │  │
│  │  └────────────────────────────────────┼──┼──┼──┼──────────────┼─┼───┘  │  │
│  │                                       │  │  │  │              │ │      │  │
│  └───────────────────────────────────────┼──┼──┼──┼──────────────┼─┼──────┘  │
│                                          │  │  │  │              │ │         │
│                                          ▼  ▼  ▼  ▼              │ │         │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                        ProofBundle v2 Builder                             │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │  │
│  │  │IterationHistory │  │ EvidenceChain   │  │ Build+Test      │           │  │
│  │  │ (all attempts)  │  │ (ISL→code link) │  │ Proof           │           │  │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘           │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                          │                                     │
│                                          ▼                                     │
│                              ┌────────────────────┐                            │
│                              │   HealResult v2    │                            │
│                              │ + ProofBundle v2   │                            │
│                              │ + Audit Trail      │                            │
│                              └────────────────────┘                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 2. Component Responsibilities

### 2.1 GateRunner
**Purpose**: Execute gate checks and produce structured violations

| Responsibility | Description |
|----------------|-------------|
| **JSON Ingestion** | Parse gate results from `@isl-lang/gate` JSON format |
| **SARIF Ingestion** | Parse SARIF 2.1.0 reports (GitHub Code Scanning compatible) |
| **Normalization** | Convert all inputs to unified `Violation[]` format |
| **Fingerprinting** | Compute deterministic fingerprint for violation set |
| **Scoring** | Calculate score with severity-weighted penalties |

### 2.2 FixRecipeRegistry
**Purpose**: Map rule IDs to deterministic fix recipes

| Responsibility | Description |
|----------------|-------------|
| **Rule Catalog** | Maintain registry of known rule IDs → fix recipes |
| **Unknown Detection** | Identify violations with no registered fix (abort trigger) |
| **Recipe Lookup** | Return appropriate `FixRecipe` for each violation |
| **No Guessing** | Never attempt to fix unknown rules |

### 2.3 FixRecipe (per rule)
**Purpose**: Define how to locate and patch code for a specific rule

| Responsibility | Description |
|----------------|-------------|
| **Match** | Identify code patterns that match the violation |
| **Locate** | Find exact AST node or text span to modify |
| **Patch** | Generate deterministic code transformation |
| **Validate** | Verify patch was applied correctly |

### 2.4 WeakeningGuard
**Purpose**: Prevent any patch that weakens intent enforcement

| Responsibility | Description |
|----------------|-------------|
| **Suppression Detection** | Block `@ts-ignore`, `eslint-disable`, `isl-ignore` |
| **Severity Downgrade** | Block patches that reduce severity |
| **Auth Bypass** | Block `skipAuth`, `noAuth`, `bypassAuth` patterns |
| **Allowlist Expansion** | Block `allowAll`, `permitAll`, broad wildcards |
| **Intent Removal** | Block any removal of intent declarations |

### 2.5 IterationRecorder
**Purpose**: Track full healing history for auditability

| Responsibility | Description |
|----------------|-------------|
| **Snapshot State** | Record code state at each iteration |
| **Record Patches** | Log all attempted and applied patches |
| **Track Violations** | Store violations at each iteration |
| **Detect Loops** | Identify repeated fingerprints (stuck condition) |

### 2.6 FrameworkAdapter
**Purpose**: Generate framework-specific code patterns

| Responsibility | Description |
|----------------|-------------|
| **Detection** | Auto-detect framework from project structure |
| **Imports** | Generate correct import statements |
| **Middleware** | Generate rate-limit, auth, audit middleware |
| **Responses** | Generate framework-specific error responses |

### 2.7 ProofBundleV2Builder
**Purpose**: Construct comprehensive proof with iteration history

| Responsibility | Description |
|----------------|-------------|
| **Evidence Linking** | Link ISL clauses to code locations |
| **Iteration History** | Include full healing attempt log |
| **Build Proof** | Include build/compile success evidence |
| **Test Proof** | Include test execution results |
| **Signature** | Cryptographically sign final bundle |

---

## 3. Exit Conditions

The healing loop terminates under exactly these conditions:

| Condition | `HealResult.reason` | `ok` | Description |
|-----------|---------------------|------|-------------|
| **SHIP** | `'ship'` | `true` | All violations resolved, gate passes |
| **Unknown Rule** | `'unknown_rule'` | `false` | Violation with unregistered rule ID |
| **Stuck Loop** | `'stuck'` | `false` | Same fingerprint repeated N times |
| **Max Iterations** | `'max_iterations'` | `false` | Reached iteration limit |
| **Weakening Detected** | `'weakening_detected'` | `false` | Patch would weaken intent |
| **Build Failure** | `'build_failed'` | `false` | Code no longer compiles |
| **Test Failure** | `'test_failed'` | `false` | Required tests fail (optional) |

---

## 4. Invariants (Contract)

These invariants are **never** violated by the healer:

```
INV-1: ISL spec is immutable after translation
       ∀ iteration i: ast(i) === ast(0)

INV-2: No suppression patterns added
       ∀ patch p: ¬contains(p.content, SUPPRESSION_PATTERNS)

INV-3: No severity downgrades
       ∀ violation v, patch p: severity(v) ≤ severity(after(p))

INV-4: Unknown rules abort (no guessing)
       ∀ violation v: v.ruleId ∉ RECIPE_REGISTRY ⟹ abort()

INV-5: Iteration history is complete
       ∀ iteration i: recorded(i) ∧ fingerprint(i) ∧ patches(i)

INV-6: Bounded execution
       iterations ≤ maxIterations

INV-7: Deterministic behavior
       ∀ input I: heal(I) === heal(I)  (same result for same input)
```

---

## 5. Data Flow

```
INPUT:
  NL prompt → Translator → ISLAST (frozen)
                              │
                              ▼
GENERATION:                CodeMap<file, content>
                              │
                              ▼
GATE (iteration 1):        GateResult { violations, score, verdict }
                              │
                    ┌─────────┴─────────┐
                    │                   │
              SHIP? ▼                   ▼ NO_SHIP
                  EXIT              CHECK RULES
                    │                   │
                    │         ┌─────────┴─────────┐
                    │         │                   │
                    │   KNOWN ▼                   ▼ UNKNOWN
                    │     LOOKUP                  ABORT
                    │     RECIPES                   │
                    │         │                     │
                    │         ▼                     │
                    │     APPLY PATCHES             │
                    │         │                     │
                    │    ┌────┴────┐                │
                    │    │         │                │
                    │ VALID?   WEAKENING?           │
                    │    │         │                │
                    │    ▼         ▼                │
                    │ RECORD    ABORT               │
                    │    │         │                │
                    │    ▼         │                │
                    │ RE-GATE ────►│                │
                    │    │         │                │
                    └────┴─────────┴────────────────┘
                              │
                              ▼
OUTPUT:              HealResult + ProofBundle v2
```

---

## 6. Security Model

### What Healer CAN Do
- ✅ Add missing rate limiting middleware
- ✅ Add missing audit logging calls
- ✅ Remove `console.log` statements (PII risk)
- ✅ Add input validation (Zod schemas)
- ✅ Add intent anchor comments/exports
- ✅ Add missing encryption markers
- ✅ Add idempotency key handling
- ✅ Refactor within touched files (minimal)

### What Healer CANNOT Do
- ❌ Remove intents from ISL spec
- ❌ Add `@ts-ignore` / `eslint-disable` / `isl-ignore`
- ❌ Downgrade violation severity
- ❌ Modify gate rules or policy packs
- ❌ Add `skipAuth` / `bypassAuth` patterns
- ❌ Broaden allowlists (`allowAll`, `*.*`)
- ❌ Guess fixes for unknown rules
- ❌ Continue healing indefinitely

### Trust Boundaries

```
┌─────────────────────────────────────────────────────┐
│                    TRUSTED                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ ISL Spec   │  │ Gate Rules │  │ Policy     │    │
│  │ (locked)   │  │ (frozen)   │  │ Packs      │    │
│  └────────────┘  └────────────┘  └────────────┘    │
├─────────────────────────────────────────────────────┤
│                 CONTROLLED (Healer)                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Fix        │  │ Code       │  │ Iteration  │    │
│  │ Recipes    │  │ Patches    │  │ History    │    │
│  └────────────┘  └────────────┘  └────────────┘    │
├─────────────────────────────────────────────────────┤
│                 OUTPUT (Auditable)                  │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Final Code │  │ Proof      │  │ Audit      │    │
│  │            │  │ Bundle     │  │ Trail      │    │
│  └────────────┘  └────────────┘  └────────────┘    │
└─────────────────────────────────────────────────────┘
```
