<p align="center">
  <img src="./assets/logo.svg" alt="Shipgate" width="200" />
</p>

<h1 align="center">Shipgate</h1>

<p align="center">
  <strong>Stop AI from shipping fake features.</strong>
</p>

<p align="center">
  <em>Powered by ISL (Intent Specification Language) — a behavioral contract system that defines what code should do, not just what types it uses.</em>
</p>

<p align="center">
  <a href="https://github.com/guardiavault-oss/ISL-LANG/actions/workflows/ci.yml"><img src="https://github.com/guardiavault-oss/ISL-LANG/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/guardiavault-oss/ISL-LANG/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
</p>

---

> **Status: v1.0.0** — Production ready.  
> Quick start: build from source (see [Install](#install-from-source)), then `pnpm isl:check` or `node packages/cli/dist/cli.cjs init my-project`. When the CLI is published to npm: `npx shipgate init`.

## What is Shipgate?

**Shipgate** blocks AI-generated "ghost features" — code that compiles but doesn't work (fake APIs, wrong env vars, type mismatches). It auto-generates a **Truthpack** from your codebase (routes, env, contracts), then verifies every PR against it. **SHIP** or **NO-SHIP.**

Under the hood, Shipgate uses **ISL (Intent Specification Language)** — behavioral specs with pre/postconditions, invariants, and side-effect constraints.

## What is ISL?

ISL lets you write **behavioral specifications** — domains, entities, behaviors with pre/postconditions — that define *what* code should do. A CLI pipeline then parses, type-checks, generates skeleton code, and verifies implementations against those specs.

The core workflow is: **spec → parse → check → generate → verify → gate (SHIP / NO-SHIP)**.

```isl
domain UserAuth {
  entity User {
    id: UUID [immutable, unique]
    email: String [unique]
    status: UserStatus
  }

  behavior Login {
    input {
      email: String
      password: String [sensitive]
    }

    output {
      success: Session
      errors { INVALID_CREDENTIALS, USER_LOCKED }
    }

    preconditions {
      email.is_valid
      password.length >= 8
    }

    postconditions {
      success implies Session.user_id == User.lookup(email).id
    }

    invariants {
      password never_logged
    }
  }
}
```

## Install from Source

```bash
git clone https://github.com/guardiavault-oss/ISL-LANG.git
cd ISL-LANG
pnpm install
pnpm build
```

Requires Node >= 18 and pnpm >= 8.

If full `pnpm build` fails (e.g. due to experimental packages), use the production-only build: `npx tsx scripts/run-production.ts build`. You can also build just the CLI from `packages/cli` after its dependencies are built.

## CLI Usage (Real Examples)

After building from source, run the CLI from the repo root. Use `specs/create-user.isl` for parse/check/gen (it parses with the current parser); `specs/example.isl` may use syntax not yet supported.

```bash
# Parse an ISL file and print the AST
node packages/cli/dist/cli.cjs parse specs/create-user.isl

# Type-check one or more ISL files
node packages/cli/dist/cli.cjs check specs/create-user.isl

# Generate TypeScript types from a spec
node packages/cli/dist/cli.cjs gen ts specs/create-user.isl -o ./generated

# Generate Rust structs/traits
node packages/cli/dist/cli.cjs gen rust specs/create-user.isl

# Generate Go structs/interfaces
node packages/cli/dist/cli.cjs gen go specs/create-user.isl

# Generate an OpenAPI 3.0 YAML spec
node packages/cli/dist/cli.cjs gen openapi specs/create-user.isl

# Format an ISL file
node packages/cli/dist/cli.cjs fmt specs/create-user.isl

# Lint an ISL file for best practices
node packages/cli/dist/cli.cjs lint specs/create-user.isl

# Initialize a new ISL project scaffold
node packages/cli/dist/cli.cjs init my-project

# Verify an implementation against a spec
node packages/cli/dist/cli.cjs verify src/auth.isl --impl src/auth.ts

# Full verification with all engines (SMT, PBT, Temporal, Chaos)
node packages/cli/dist/cli.cjs verify src/auth.isl --impl src/auth.ts --all

# Property-Based Testing (Phase 3)
node packages/cli/dist/cli.cjs pbt specs/auth.isl
node packages/cli/dist/cli.cjs pbt specs/auth.isl --num-tests 500 --seed 12345

# Chaos Engineering (Phase 3)
node packages/cli/dist/cli.cjs chaos specs/payments.isl
node packages/cli/dist/cli.cjs chaos specs/payments.isl --scenario network_failure

# SHIP/NO-SHIP gate (verify + trust score + evidence bundle)
node packages/cli/dist/cli.cjs gate src/auth.isl --impl src/auth.ts
node packages/cli/dist/cli.cjs gate src/auth.isl --impl src/auth.ts --threshold 80

# Start the interactive REPL
node packages/cli/dist/cli.cjs repl

# Watch ISL files and re-check on changes
node packages/cli/dist/cli.cjs watch
```

**Tip:** From repo root use `pnpm isl:check`, `pnpm isl:gen`, `pnpm isl:verify`, `pnpm isl:gate`. Or from the CLI package: `cd packages/cli && node dist/cli.cjs parse ../../specs/create-user.isl`.

### Quick ISL loop (root scripts)

From the repo root you can run the standard spec → check → gen → implement → verify → gate loop:

```bash
pnpm isl:check    # Validate specs (e.g. specs/)
pnpm isl:gen      # Generate TypeScript from specs
pnpm isl:verify   # Verify implementation vs spec (default: specs/example.isl, impl .)
pnpm isl:gate     # Run SHIP/NO-SHIP gate (default spec/impl, threshold 95)
```

See [docs/ISL_DEVELOPMENT_LOOP.md](docs/ISL_DEVELOPMENT_LOOP.md) for the full development loop, spec locations, and Cursor/ISL integration.

All commands support `--format json` for machine-readable output and `--verbose` for debug info.

**Exit codes:** 0 = success/SHIP, 1 = ISL errors/NO-SHIP, 2 = usage error, 3 = internal error.

## Working Features

These features have source code, tests, and are used in the CI pipeline:

- **Parser** — Recursive-descent parser with error recovery. Handles domains, entities, behaviors, types, pre/postconditions, invariants, and imports.
- **Type Checker** — Validates AST structure, resolves types, builds symbol table. This is structural type checking, not refinement types.
- **Code Generation (CLI `gen` command)** — Generates skeleton types/interfaces/structs for **TypeScript, Rust, Go, and OpenAPI**. Output is structural (types, interfaces, traits) — not full application code.
- **Runtime Verification** — Evaluates pre/postconditions and invariants against an implementation at runtime.
- **CLI** — Full command set: `parse`, `check`, `gen`, `verify`, `pbt`, `chaos`, `init`, `fmt`, `lint`, `gate`, `trust-score`, `heal`, `proof`, `watch`, `repl`, `build`.
- **Gate Pipeline** — SHIP/NO-SHIP decision with trust scoring, evidence bundles, and proof verification.
- **Import Resolver** — Resolves cross-file ISL imports and stdlib references.
- **Evaluator** — Expression evaluator for ISL contract evaluation (95%+ coverage).
- **REPL** — Interactive read-eval-print loop for ISL expressions.
- **Property-Based Testing** — `isl pbt` command with generators for all ISL types, shrinking, and postcondition verification.
- **Chaos Engineering** — `isl chaos` command with fault injection (network, database, latency, service dependencies).
- **Trust Score** — 0–100 composite scoring with configurable gates and history tracking.

## Phase 3 Complete (Verification)

The following verification features are now **production-ready** as of Phase 3:

- **SMT Verification** — Formal satisfiability checking with builtin solver (Z3/CVC5 optional). Integrated into `isl verify --smt`.
- **Property-Based Testing** — Full PBT with generators, shrinking, postcondition verification. Use `isl pbt <spec>`.
- **Chaos Engineering** — Fault injection scenarios (network, database, latency, service deps). Use `isl chaos <spec>`.
- **Temporal Verification** — Latency SLA (p50/p95/p99), eventually-within, always/never properties. Integrated into verify pipeline.
- **Trust Score** — 0–100 composite scoring with configurable weights and gates.
- **Proof Bundles** — Immutable verification records with SMT, PBT, chaos, and temporal evidence.

## Experimental / In Progress

These exist as packages with partial implementations. They are **not production-ready** and are excluded from the default build:

- **VS Code Extension** — Syntax highlighting grammar exists. LSP integration and IntelliSense are incomplete. Marked `private` and `experimental`.
- **Python Codegen** — Separate package with FastAPI/Pydantic templates. Not exercised by the CLI `gen` command.
- **GraphQL Codegen** — Separate package. Not exercised by the CLI `gen` command.
- **AI Integration** — `ai-copilot`, `ai-generator`, `isl-ai`, `agent-os` packages. Deferred to Phase 4.
- **200+ additional packages** — SDK generators, observability integrations, platform services, etc. See `experimental.json` for the full categorization. Most are stubs or shells.

## Limitations

- **CLI not yet published to npm.** Build from source, then run `node packages/cli/dist/cli.cjs <command>` from repo root or use `pnpm isl:check`, `pnpm isl:gen`, etc. When published: `npx shipgate init`.
- **Code generation is structural only.** `isl gen ts` emits TypeScript interfaces and type aliases — not runnable application code. You (or an LLM) write the implementation; ISL verifies it.
- **No refinement types.** The type checker validates AST structure and resolves type references. It does not do refinement type checking or dependent type analysis.
- **Verification requires an implementation file.** `isl verify` and `isl gate` need a `--impl` flag pointing to your code. There is no automatic implementation discovery.
- **Formal verification requires external tools.** SMT-based verification needs Z3 or CVC5 installed separately and is experimental.
- **Monorepo is large.** ~200 packages exist, but only ~30 are production-quality. The rest are experimental scaffolding. See `experimental.json` for the canonical list.

## LLM / AI Integration — What It Actually Does

ISL is designed to work **alongside** LLMs, not replace them. The realistic workflow:

1. **You write an ISL spec** defining domains, entities, behaviors, and contracts.
2. **An LLM generates an implementation** (TypeScript, etc.) based on the spec.
3. **`isl verify` checks the implementation** against the spec's pre/postconditions and invariants at runtime.
4. **`isl gate` makes a SHIP/NO-SHIP decision** with a trust score and evidence bundle.
5. **`isl heal` attempts automatic fixes** for violations found during verification.

ISL does **not** call LLM APIs itself. It provides the specification and verification layer. The LLM integration is in your workflow, not in ISL's runtime.

## Packages (Production)

| Package | Status | Description |
|---------|--------|-------------|
| `@isl-lang/parser` | ✅ Production | Recursive-descent ISL parser |
| `@isl-lang/typechecker` | ✅ Production | AST validation and type resolution |
| `@isl-lang/evaluator` | ✅ Production | Expression and contract evaluator |
| `shipgate` | ✅ Production | Full CLI (bin: `isl`, `shipgate`); build from source; publish TBD |
| `@isl-lang/repl` | ✅ Production | Interactive REPL |
| `@isl-lang/verifier-runtime` | ✅ Production | Runtime pre/postcondition verification |
| `@isl-lang/import-resolver` | ✅ Production | Cross-file import resolution |
| `@isl-lang/codegen` | ✅ Production | Code generation umbrella (TS, Rust, Go, OpenAPI) |
| `@isl-lang/isl-gate` | ✅ Production | SHIP/NO-SHIP gate engine |
| `@isl-lang/isl-proof` | ✅ Production | Proof bundle creation and verification |
| `@isl-lang/isl-pbt` | ✅ Production | Property-based testing |
| `@isl-lang/verifier-chaos` | ✅ Production | Chaos engineering / fault injection |
| `@isl-lang/verifier-temporal` | ✅ Production | Temporal property verification |
| `@isl-lang/isl-smt` | ✅ Production | SMT-based formal verification |
| `@isl-lang/vscode` | 🧪 Experimental | VS Code extension (syntax highlighting only) |

For the full package categorization, see [`experimental.json`](./experimental.json).

## Documentation

- [Language Specification](./ISL-LANGUAGE-SPEC.md)
- [How It Works](./docs/HOW_IT_WORKS.md)
- [Standard Library](./STDLIB.md)
- [Phase 3 Release Notes](./docs/PHASE3_RELEASE.md)
- [Phase 3 Completion Checklist](./PHASE-3-COMPLETION-CHECKLIST.md)
- [Verification System](./docs/VERIFICATION.md)
- [README Verification (v1.0)](./docs/README_VERIFICATION_1_0.md) — Commands and link status for v1.0.0
- [Examples](./examples/)
- [Package Categorization](./experimental.json)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) © mevla
# ShipGate
