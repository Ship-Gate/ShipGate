<p align="center">
  <img src="./assets/logo.svg" alt="ISL Logo" width="200" />
</p>

<h1 align="center">ISL — Intent Specification Language</h1>

<p align="center">
  <strong>A behavioral specification language with a verify-and-gate pipeline for AI-generated code</strong>
</p>

<p align="center">
  <a href="https://github.com/guardiavault-oss/ISL-LANG/actions/workflows/ci.yml"><img src="https://github.com/guardiavault-oss/ISL-LANG/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/guardiavault-oss/ISL-LANG/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" /></a>
</p>

---

> **Status: Pre-release (v0.1.0).** The npm `@isl-lang/cli` package is a name-reservation placeholder.
> To use ISL today, clone this repo and build from source. See [Install from Source](#install-from-source).

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

## CLI Usage (Real Examples)

After building from source, run commands via the workspace:

```bash
# Parse an ISL file and print the AST
pnpm --filter @isl-lang/cli exec isl parse specs/example.isl

# Type-check one or more ISL files
pnpm --filter @isl-lang/cli exec isl check specs/example.isl

# Generate TypeScript types from a spec
pnpm --filter @isl-lang/cli exec isl gen ts specs/example.isl -o ./generated

# Generate Rust structs/traits
pnpm --filter @isl-lang/cli exec isl gen rust specs/example.isl

# Generate Go structs/interfaces
pnpm --filter @isl-lang/cli exec isl gen go specs/example.isl

# Generate an OpenAPI 3.0 YAML spec
pnpm --filter @isl-lang/cli exec isl gen openapi specs/example.isl

# Format an ISL file
pnpm --filter @isl-lang/cli exec isl fmt specs/example.isl

# Lint an ISL file for best practices
pnpm --filter @isl-lang/cli exec isl lint specs/example.isl

# Initialize a new ISL project scaffold
pnpm --filter @isl-lang/cli exec isl init my-project

# Verify an implementation against a spec
pnpm --filter @isl-lang/cli exec isl verify src/auth.isl --impl src/auth.ts

# SHIP/NO-SHIP gate (verify + trust score + evidence bundle)
pnpm --filter @isl-lang/cli exec isl gate src/auth.isl --impl src/auth.ts

# Start the interactive REPL
pnpm --filter @isl-lang/cli exec isl repl

# Watch ISL files and re-check on changes
pnpm --filter @isl-lang/cli exec isl watch
```

**Tip:** For shorter invocations, `cd packages/cli && pnpm exec isl parse ../../specs/example.isl` also works.

All commands support `--format json` for machine-readable output and `--verbose` for debug info.

**Exit codes:** 0 = success/SHIP, 1 = ISL errors/NO-SHIP, 2 = usage error, 3 = internal error.

## Working Features

These features have source code, tests, and are used in the CI pipeline:

- **Parser** — Recursive-descent parser with error recovery. Handles domains, entities, behaviors, types, pre/postconditions, invariants, and imports.
- **Type Checker** — Validates AST structure, resolves types, builds symbol table. This is structural type checking, not refinement types.
- **Code Generation (CLI `gen` command)** — Generates skeleton types/interfaces/structs for **TypeScript, Rust, Go, and OpenAPI**. Output is structural (types, interfaces, traits) — not full application code.
- **Runtime Verification** — Evaluates pre/postconditions and invariants against an implementation at runtime.
- **CLI** — Full command set: `parse`, `check`, `gen`, `verify`, `init`, `fmt`, `lint`, `gate`, `trust-score`, `heal`, `proof`, `watch`, `repl`, `build`.
- **Gate Pipeline** — SHIP/NO-SHIP decision with trust scoring, evidence bundles, and proof verification.
- **Import Resolver** — Resolves cross-file ISL imports and stdlib references.
- **Evaluator** — Expression evaluator for ISL contract evaluation.
- **REPL** — Interactive read-eval-print loop for ISL expressions.

## Experimental / In Progress

These exist as packages with partial implementations. They are **not production-ready** and are excluded from the default build:

- **VS Code Extension** — Syntax highlighting grammar exists. LSP integration and IntelliSense are incomplete. Marked `private` and `experimental`.
- **Python Codegen** — Separate package with FastAPI/Pydantic templates. Not exercised by the CLI `gen` command.
- **GraphQL Codegen** — Separate package. Not exercised by the CLI `gen` command.
- **Formal Verification** — SMT-based verification (Z3/CVC5). Requires external solver binaries. Incomplete.
- **Security Verification** — Security-focused checks. Incomplete.
- **Chaos Verification** — Fault-injection testing. Incomplete.
- **Temporal Verification** — Latency SLA / eventually-within checks. Incomplete.
- **Property-Based Testing** — PBT integration. Incomplete.
- **200+ additional packages** — SDK generators, observability integrations, platform services, etc. See `experimental.json` for the full categorization. Most are stubs or shells.

## Limitations

- **No published npm packages.** `npm install -g @isl-lang/cli` installs a placeholder that prints "coming soon." You must build from source.
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
| `@isl-lang/cli` | ✅ Production | Full CLI (source-only, not published to npm) |
| `@isl-lang/repl` | ✅ Production | Interactive REPL |
| `@isl-lang/verifier-runtime` | ✅ Production | Runtime pre/postcondition verification |
| `@isl-lang/import-resolver` | ✅ Production | Cross-file import resolution |
| `@isl-lang/codegen` | ✅ Production | Code generation umbrella (TS, Rust, Go, OpenAPI) |
| `@isl-lang/isl-gate` | ✅ Production | SHIP/NO-SHIP gate engine |
| `@isl-lang/isl-proof` | ✅ Production | Proof bundle creation and verification |
| `@isl-lang/vscode` | 🧪 Experimental | VS Code extension (syntax highlighting only) |
| `@isl-lang/verifier-formal` | 🧪 Experimental | SMT-based formal verification |
| `@isl-lang/verifier-security` | 🧪 Experimental | Security verification |

For the full package categorization, see [`experimental.json`](./experimental.json).

## Documentation

- [Language Specification](./ISL-LANGUAGE-SPEC.md)
- [How It Works](./docs/HOW_IT_WORKS.md)
- [Standard Library](./STDLIB.md)
- [Examples](./examples/)
- [Package Categorization](./experimental.json)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

[MIT](./LICENSE) © mevla
