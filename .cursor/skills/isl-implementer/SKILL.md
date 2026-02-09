# ISL Implementer Skill

## When to Use

Use this skill when:
- Implementing a **behavior** or **API** that is (or should be) specified in an ISL file.
- Adding new functionality that has preconditions, postconditions, or declared errors.
- Fixing verification failures after running `isl verify` or the ISL gate.

## Prerequisites

1. **Locate the spec** – Find the `.isl` file that defines the behavior (e.g. `specs/*.isl`, `.shipgate/specs/*.isl`, `examples/*.isl`).
2. **Ensure spec is valid** – Run `pnpm isl:check` from repo root (or `pnpm exec isl check <path>`).

## Implementation Steps

### 1. Read the Spec

From the ISL file, extract for the target behavior:
- **Input** – Parameter names and types.
- **Output** – Success type and all **errors** (with when/retriable if present).
- **Preconditions** – What is guaranteed true before the behavior runs.
- **Postconditions** – What must hold after success (and, if used, `old(...)` values).
- **Invariants** – Global or entity invariants that must never be violated.

### 2. Use or Generate Types

- If generated code exists (e.g. `examples/generated/*.ts`, `generated/ts/*.ts`), **import types and wrappers** from there.
- If not, run codegen from repo root:
  - `pnpm isl:gen` or `pnpm exec isl gen ts <spec-path>`
  - Then implement against the generated types.

### 3. Implement

- **Preconditions**: Assume they hold; do not re-check in core logic unless you are building the wrapper itself.
- **Postconditions**: Ensure every state change and return value satisfies the spec.
- **Errors**: Throw or return only the declared error variants; use the same names/codes as in the spec.
- **Invariants**: Do not write code that can break any listed invariant.

### 4. Verify

- Run `pnpm isl:verify` (or `pnpm exec isl verify <spec> --impl <impl-path>`).
- If the project uses the ISL gate in CI, run `pnpm isl:gate` (or `isl gate <spec> --impl <path>`) and fix any NO-SHIP result.

## Project Layout (IntentOS)

| What        | Location(s) |
|------------|-------------|
| Specs      | `specs/`, `.shipgate/specs/`, `examples/*.isl`, `corpus/`, `stdlib/` |
| Generated  | `examples/generated/`, `generated/ts/`, package `src/generated/` |
| Config     | `.islrc.json` |
| Gate/CI    | `.github/workflows/isl-gate.yml` |

## Commands (from repo root)

```bash
pnpm isl:check          # Validate all specs (config-driven)
pnpm isl:gen             # Generate TypeScript from specs
pnpm isl:verify          # Verify implementation vs spec
pnpm isl:gate            # Run SHIP/NO-SHIP gate (e.g. for CI)
```

Or via CLI package:

```bash
pnpm exec isl check specs/
pnpm exec isl gen ts specs/example.isl
pnpm exec isl verify specs/example.isl --impl src/
pnpm exec isl gate specs/example.isl --impl src/ --threshold 95
```

## Rules to Follow

- `.cursor/rules/isl-implement.mdc` – Implementation discipline (read spec, use generated code, verify).
- `.cursor/rules/isl-spec-first.mdc` – When adding new behaviors, define them in ISL first.
- `.cursor/rules/isl-development.mdc` – General ISL-guided development (pre/post, errors, invariants).

## Example Snippet (TypeScript)

After codegen, use the generated wrapper pattern when available:

```typescript
import { createTransferFundsWrapper } from './generated/payments/transfer-funds.wrapper';

async function transferFundsImpl(input: TransferFundsInput): Promise<Transaction> {
  // Your implementation; preconditions assumed, postconditions enforced by wrapper
  // ...
}

export const transferFunds = createTransferFundsWrapper(transferFundsImpl);
```

If no wrapper exists, implement the behavior so that:
- On success, all postconditions hold.
- On failure, only declared errors are used, with messages aligned to the spec.
