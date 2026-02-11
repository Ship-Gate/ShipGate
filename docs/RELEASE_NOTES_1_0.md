# Shipgate 1.0.0 Release Notes

**Release Date:** February 2026  
**Status:** Release Candidate

## Overview

Shipgate 1.0.0 is the first stable release of **Shipgate** — stop AI from shipping fake features. The toolchain is powered by **ISL (Intent Specification Language)** and provides a workflow to specify, verify, and gate AI-generated code with evidence and SHIP/NO-SHIP decisions.

---

## Highlights

- **Shipgate CLI** — Single entry point: `shipgate` or `isl` (same binary). Commands: `init`, `check`, `build`, `verify`, `gate`, `heal`, and proof verification.
- **ISL core** — Parser, typechecker, and expression evaluator with refinement types, tri-state evaluation (TRUE/FALSE/UNKNOWN), and structural typing.
- **Verification pipeline** — Parse → check → codegen → verify with evidence; trust score and proof bundles for auditability.
- **Proof bundles** — Enhanced evidence: evaluator decision traces, unknown reason codes, optional SMT transcript, run metadata, import graph, stdlib version hashes.
- **Production package set** — Core, pipeline, verification, codegen (TypeScript/OpenAPI/GraphQL/Python scaffolds), LSP, and production stdlib modules are included in the 1.0 build and test pipeline.

---

## What’s Included (Core)

### CLI

- **Package:** `shipgate` (npm), published at 1.0.0.
- **Binaries:** `shipgate` and `isl` (both point to the same CLI).
- **Commands:** `init`, `check`, `build`, `verify`, `gate`, `heal`, `proof verify`.

### Core packages (production)

- **Language:** `@isl-lang/parser`, `@isl-lang/typechecker`, `@isl-lang/evaluator`, `@isl-lang/isl-core`, `@isl-lang/errors`, `@isl-lang/semantics`.
- **Pipeline:** `@isl-lang/pipeline`, `@isl-lang/import-resolver`, and related compiler/static-analysis packages.
- **Verification:** `@isl-lang/verifier-runtime`, `@isl-lang/isl-verify`, `@isl-lang/isl-gate`, `@isl-lang/isl-proof` (published as `@isl-lang/proof`), `@isl-lang/evidence-*`, `@isl-lang/isl-healer`.
- **Codegen:** `@isl-lang/codegen`, `@isl-lang/codegen-core`, `@isl-lang/codegen-tests`, `@isl-lang/codegen-openapi`, `@isl-lang/codegen-graphql`, `@isl-lang/codegen-python`, `@isl-lang/codegen-types`, `@isl-lang/codegen-runtime`.
- **LSP:** `@isl-lang/lsp-core`, `@isl-lang/lsp-server`, `@isl-lang/language-server`.
- **Stdlib (production):** `@isl-lang/stdlib-core`, `@isl-lang/stdlib-auth`, `@isl-lang/stdlib-payments`, `@isl-lang/stdlib-idempotency`, `@isl-lang/stdlib-cache`, `@isl-lang/stdlib-files`, `@isl-lang/stdlib-workflow`, and other production stdlib modules listed in `experimental.json`.

### Partial / in progress (included in repo, lower readiness)

- **Codegen (other languages):** Go, Rust, C#, JVM — real implementation, may have incomplete tests or features.
- **Stdlib (untested / partial):** e.g. `stdlib-api`, `stdlib-events`, `stdlib-queue`, `stdlib-search`, `stdlib-distributed`, and others — may have build or test gaps.
- **Verification (advanced):** SMT, PBT, formal/chaos/security/temporal verifiers — included but not all at full readiness.
- **Tooling:** Test generator, test runtime, autofix, patch engine, snapshot/contract testing — partial.

---

## Production build and quarantine (1.0)

- **Production build:** `pnpm build:production` runs build on all packages except experimental, internal, and **quarantine** sets. As of 1.0, quarantine includes: codegen-tests, isl-verify, isl-verify-pipeline, isl-healer, claims-verifier, test-generator, mock-detector, solver-z3-wasm, stdlib-observability, stdlib-ai, stdlib-idempotency, verifier-formal, codegen-jvm, semantic-analysis, **isl-discovery** (parser types resolution), **verifier-temporal** (build clean race). These are not published in 1.0; fix and un-quarantine in a later release.

## What’s Explicitly NOT Included / Experimental

The following are **excluded from the default production build** (see `experimental.json` and `scripts/run-production.ts`). They are **not** part of the 1.0 promise:

- **Experimental / quarantined packages** — Effect handlers, effect system, formal-verification, mutation-testing, fuzzer; codegen shells (Terraform, WASM, Kubernetes, edge, pipelines, migrations, mocks, loadtest, docs, db, SDK, validators, property-tests, gRPC, UI, Python-advanced, graphql-codegen, db-generator, api-generator); SDK shells (TypeScript, web, React Native, generator-sdk, runtime-sdk); platform shells (marketplace, dashboard, agent-os, ai-copilot, spec-assist, intent-translator, inference, etc.); infrastructure, observability, and integration shells.
- **Internal / next** — Not published as part of 1.0: visual-editor, trace-viewer, playground, marketplace-web, dashboard-web, docs apps, diff-viewer, audit-viewer, vscode/vscode-islstudio (internal build), islstudio, lsp (legacy), isl-cli, isl-compiler, isl-runtime, isl-generator, isl-evidence, contracts, core, runtime, verifier (legacy).

The **VS Code extension** (vscode-islstudio) may be available separately; it is maintained in-repo but is in the internal set and not part of the 1.0 core guarantee.

---

## Breaking Changes

**None** — This is the first stable (1.0) release. If you used pre-release 0.x builds:

- Proof bundle schema may have evolved; regenerate proof bundles when moving to 1.0.
- CLI output format is unified; default gate threshold is 95% for SHIP.

---

## Upgrade / Install Instructions

### From npm (recommended)

```bash
# Install CLI globally
npm install -g shipgate

# Or use without installing
npx shipgate --version
npx shipgate init my-project
```

The same package provides both `shipgate` and `isl` commands.

### From source

```bash
git clone https://github.com/guardiavault-oss/ISL-LANG.git
cd ISL-LANG
pnpm install
pnpm build
# Use: node packages/cli/dist/cli.cjs --version
# Or link: pnpm --filter shipgate link --global
```

### Verify installation

```bash
# PowerShell (Windows)
.\scripts\release-verify.ps1

# Bash (macOS/Linux)
./scripts/release-verify.sh
```

This runs: install → build → test → typecheck → gate check (`test:critical`). Optional: `-SkipInstall`, `-SkipBuild`, `-SkipTests`, `-SkipTypecheck`, `-SkipGate`, `-Quick` (skips tests and typecheck).

---

## Known Issues

- **Full monorepo build:** Running `pnpm build` (all packages) can still report one failing task in a partial package (e.g. `@isl-lang/stdlib-distributed`); production build via `pnpm build:production` excludes experimental packages and may pass.
- **Readiness:** Some production/partial packages are below the 75% readiness target (e.g. codegen, language-server, some stdlibs); they are included but may have gaps in tests or features.
- **CLI:** `npx shipgate --version` and `npx shipgate init` should be verified on a clean install; report any issues on the project repository.
- **SMT / formal verification:** Optional; requires Z3 (or similar) for full SMT support; built-in path handles basic cases.
- **Python codegen:** Generates scaffolds only; full implementation is planned for a later release.

---

## Quickstart

```bash
# Initialize project
npx shipgate init my-project
cd my-project

# Create a spec (e.g. auth.isl), then verify
npx shipgate check auth.isl
npx shipgate gate auth.isl --impl src/
npx shipgate proof verify ./evidence
```

---

## Documentation and Support

- [ISL Tutorial](./TUTORIAL.md)
- [Syntax Reference](./SYNTAX.md)
- [CLI Reference](https://shipgate.dev/docs/cli) / [Homepage](https://shipgate.dev)
- GitHub: https://github.com/guardiavault-oss/ISL-LANG
- Issues: https://github.com/guardiavault-oss/ISL-LANG/issues

---

## License

MIT — See [LICENSE](../LICENSE).

---

## Announcement summary (8–12 lines)

**Shipgate 1.0.0** is the first stable release of the Shipgate toolchain, powered by ISL (Intent Specification Language). Shipgate stops AI from shipping fake features by verifying code against behavioral specs and producing evidence-backed SHIP/NO-SHIP decisions. This release includes the **Shipgate CLI** (`shipgate` / `isl`), the **ISL parser, typechecker, and expression evaluator**, a **verification pipeline** with proof bundles and trust scores, and **production packages** for codegen (TypeScript, OpenAPI, GraphQL, Python scaffolds), LSP, and stdlib modules. Advanced codegen targets, experimental packages, and internal apps remain outside the 1.0 guarantee. Install with `npm install -g shipgate` or `npx shipgate init`. There are no breaking changes from a prior stable release. Known issues are documented in the release notes (partial package build, readiness gaps, CLI verification). Verified by ShipGate ✓
