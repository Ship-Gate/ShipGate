# Implicit Assumptions

This document lists assumptions that the ISL verification pipeline, auto-verify, and runtime have historically relied on without enforcing. **Enforceable assumptions** are now checked at runtime via the assumption-enforcement layer; violations fail loudly.

---

## Pipeline Assumptions

| ID | Assumption | Category | Impact | Enforced |
|----|------------|----------|--------|----------|
| P1 | `workspacePath` exists and is a directory | environment | high | Yes – `assertWorkspacePath()` |
| P2 | Pipeline input is well-formed (prompt string or valid AST) | input | high | Yes – `assertPipelineInput()` |
| P3 | AST has required shape (name, behaviors/entities) when in `ast` mode | input | high | Yes – `assertValidAst()` |
| P4 | `outDir` is writable when `writeReport` is true | environment | medium | Yes – `assertWritableOutDir()` |

---

## Auto-Verify Assumptions

| ID | Assumption | Category | Impact | Enforced |
|----|------------|----------|--------|----------|
| A1 | Implementation code exists and is accessible | environment | high | Yes – `assertImplementationAccessible()` |
| A2 | Generated code matches spec version (no drift) | dependency | medium | Documented only; not runtime-enforceable |

---

## Runtime / Evidence Assumptions

| ID | Assumption | Category | Impact | Enforced |
|----|------------|----------|--------|----------|
| R1 | State passed to `captureState()` / `old()` is JSON-serializable | input | high | Yes – `assertSerializableState()` |
| R2 | Evidence report structure matches schema (version, required fields) | input | medium | Yes – via evidence schema validation |
| R3 | Assumption objects have valid category and impact | input | low | Yes – `AssumptionSchema` in evidence |

---

## Dependency / Environment Assumptions

| ID | Assumption | Category | Impact | Enforced |
|----|------------|----------|--------|----------|
| D1 | Required packages (e.g. parser) resolve at runtime | dependency | high | No – module load fails naturally |
| D2 | No stub or skipped steps when strict verification is required | environment | medium | Documented; pipeline warnings surfaced in report |

---

## What Is Not Enforced

- **Timing**: No guarantee that verification completes within a fixed time.
- **Spec/code drift**: No automatic check that generated code matches current spec (A2 is documented only).
- **External solver availability**: SMT/formal steps may assume Z3/CVC5 present; failure is handled by step result, not a precondition guard.

---

## See Also

- **Runtime guarantees**: [RUNTIME_GUARANTEES.md](./RUNTIME_GUARANTEES.md) – what is guaranteed when enforcement is enabled.
- **Enforcement API**: `@isl-lang/core` – `assertWorkspacePath`, `assertPipelineInput`, `assertValidAst`, `assertWritableOutDir`, `assertSerializableState`, `assertImplementationAccessible`.
