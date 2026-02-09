# ISL Development Loop

This doc describes how to integrate ISL (Intent Specification Language) into your daily workflow in the IntentOS monorepo so that **specs stay the source of truth** and implementations stay verified.

## 1. Where Things Live

| What | Location(s) |
|------|-------------|
| **Project specs** | `specs/**/*.isl` (main; referenced by `.islrc.json`) |
| **ShipGate / session specs** | `.shipgate/specs/*.isl` |
| **Examples** | `examples/*.isl`, `corpus/`, `demos/**/*.isl` |
| **Stdlib** | `stdlib/**/*.isl` (shared domains; use via `use stdlib-*`) |
| **Generated TypeScript** | `examples/generated/`, `generated/ts/`, package `src/generated/` |
| **Config** | `.islrc.json` (spec paths, codegen targets, LSP) |

## 2. The Loop

1. **Create or edit the ISL spec**  
   Define or update `domain`, `entity`, and `behavior` blocks. Use `specs/example.isl`, `examples/auth.isl`, or `stdlib/` as style references.

2. **Validate**  
   From repo root:
   ```bash
   pnpm isl:check
   ```
   Or: `pnpm exec isl check specs/` (or a specific file).

3. **Generate (if needed)**  
   Generate types and/or verification wrappers:
   ```bash
   pnpm isl:gen
   ```
   Or: `pnpm exec isl gen ts specs/` or `isl gen ts <file>`.

4. **Implement**  
   Write code against the generated types. Respect preconditions (assume they hold), postconditions (ensure they hold), and declared errors only. See `.cursor/rules/isl-implement.mdc` and `.cursor/rules/isl-development.mdc`.

5. **Verify**  
   Check that implementation satisfies the spec:
   ```bash
   pnpm isl:verify
   ```
   Or: `pnpm exec isl verify specs/example.isl --impl .` (adjust paths as needed).

6. **Gate (CI / SHIP-NO-SHIP)**  
   Run the full gate (e.g. before merge):
   ```bash
   pnpm isl:gate
   ```
   Or: `pnpm exec isl gate specs/example.isl --impl . --threshold 95 --format json`.  
   CI uses `.github/workflows/isl-gate.yml` to block merge on NO-SHIP.

## 3. Root Scripts (package.json)

From repo root you can run:

- `pnpm isl:check` – Validate specs (e.g. `specs/`)
- `pnpm isl:gen` – Generate TypeScript from specs
- `pnpm isl:verify` – Verify implementation vs spec (default: `specs/example.isl`, impl `.`)
- `pnpm isl:gate` – Run SHIP/NO-SHIP gate (default spec/impl as above, threshold 95)

Override by calling the CLI directly, e.g.:

```bash
pnpm --filter @isl-lang/cli exec isl check specs/
pnpm --filter @isl-lang/cli exec isl gen ts specs/create-user.isl
pnpm --filter @isl-lang/cli exec isl verify specs/create-user.isl --impl src/
pnpm --filter @isl-lang/cli exec isl gate specs/create-user.isl --impl src/ --threshold 95
```

Ensure the CLI is built first (`pnpm build` or `pnpm --filter @isl-lang/cli build`).

## 4. New Behavior / New Spec

When adding a **new** behavior or API:

1. Add or update the `.isl` file first (see `.cursor/rules/isl-spec-first.mdc`).
2. Run `pnpm isl:check` then `pnpm isl:gen`.
3. Implement using generated types; then run `pnpm isl:verify` and fix until it passes.

To scaffold a new spec:

```bash
pnpm exec isl init
```

Then edit the created file and continue the loop.

## 5. Cursor / AI Integration

- **Rules**: `.cursor/rules/isl-implement.mdc`, `isl-spec-first.mdc`, `isl-development.mdc` guide implementation and spec-first workflow.
- **Skill**: `.cursor/skills/isl-implementer/SKILL.md` – use when implementing from an ISL spec or fixing verify/gate failures.
- **.cursorrules**: Includes ISL workflow summary and spec/generated locations so the AI keeps ISL in mind.

## 6. CI

- **ISL Gate**: `.github/workflows/isl-gate.yml` runs on PRs (e.g. to `main`/`master`) when `src/**`, `specs/**`, or `*.isl` change. It runs the gate, posts a comment, uploads evidence, and fails the check on NO-SHIP.

Deepening ISL integration means: **spec first → check → gen → implement → verify → gate**, with Cursor rules and skills and root scripts making that loop the default.
