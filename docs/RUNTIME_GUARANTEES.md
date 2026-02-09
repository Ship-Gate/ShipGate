# Runtime Guarantees

When the assumption-enforcement layer is enabled (`enforceAssumptions: true` / `strictSteps: true`), the ISL pipeline provides the following runtime guarantees. Violations throw `AssumptionViolationError` and **fail loudly**.

---

## Guarantee Matrix

| ID | Guard | What It Guarantees | Trigger |
|----|-------|--------------------|---------|
| P1 | `assertWorkspacePath()` | `workspacePath` exists and is a directory | `enforceAssumptions: true` |
| P2 | `assertPipelineInput()` | Pipeline input is a well-formed prompt string or valid AST | `enforceAssumptions: true` |
| P3 | `assertValidAst()` | AST has `Domain` kind, name, version, and all required arrays | `enforceAssumptions: true` (ast mode) |
| P4 | `assertWritableOutDir()` | Output directory exists (or can be created) and is writable | `enforceAssumptions: true` + `writeReport: true` |
| A1 | `assertImplementationAccessible()` | Implementation path is readable | Called by auto-verify |
| R1 | `assertSerializableState()` | State passed to `captureState()` / `old()` is JSON-serializable | Called by evidence runtime |
| D1 | `assertRequiredPackages()` | Listed packages resolve via `createRequire` | `enforceAssumptions: true` + `requiredPackages` provided |
| D2 | `assertNoSkippedSteps()` | No pipeline step was skipped, stubbed, or failed | `strictSteps: true` |

---

## How to Enable

```typescript
import { runPipeline } from '@isl-lang/core/pipeline';

const result = await runPipeline(
  { mode: 'ast', ast: myAst },
  {
    workspacePath: '/my/project',
    enforceAssumptions: true,   // enables P1–P4, D1
    strictSteps: true,          // enables D2
  }
);
```

### Standalone Guards

Each guard can also be called independently:

```typescript
import {
  assertWorkspacePath,
  assertRequiredPackages,
  assertNoSkippedSteps,
} from '@isl-lang/core';

await assertWorkspacePath('/my/project');
assertRequiredPackages(['@isl-lang/parser'], '/my/project');
```

---

## Error Shape

Every violation produces an `AssumptionViolationError` with:

| Field | Type | Description |
|-------|------|-------------|
| `code` | `AssumptionViolationCodeType` | Machine-readable error code (e.g. `ASSUMPTION_AST_INVALID`) |
| `assumptionId` | `string` | Maps back to the assumption table (e.g. `P3`, `D1`) |
| `message` | `string` | Human-readable explanation |
| `context` | `Record<string, unknown>` | Structured diagnostic data |
| `cause` | `Error \| undefined` | Original error, if any |

Errors serialize cleanly via `toJSON()` for evidence reports.

---

## What Is Not Guaranteed

- **Timing**: No fixed-time completion guarantee.
- **Spec/code drift** (A2): Not runtime-enforceable; documented only.
- **External solver availability**: SMT/formal step failures are handled by step results, not precondition guards.

---

## See Also

- [IMPLICIT_ASSUMPTIONS.md](./IMPLICIT_ASSUMPTIONS.md) – full assumption inventory.
- `@isl-lang/core` source: `packages/core/src/assumption-enforcement/`.
