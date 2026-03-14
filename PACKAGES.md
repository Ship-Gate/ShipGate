# ShipGate Package Maturity Index

> Every package in this monorepo has a maturity tier. Use this to know what's
> production-ready, what's stable but evolving, and what's experimental.

## Tiers

| Tier | Meaning | Expectations |
|------|---------|--------------|
| **Core** | Critical to the product. Well-tested, actively maintained. | Breaking changes go through RFC. Full test coverage. |
| **Stable** | Works, has tests, ships value. | May evolve. APIs may change with deprecation notices. |
| **Beta** | Functional but incomplete. | Expect gaps. Contributions welcome. |
| **Experimental** | Early exploration or scaffolding. | May be removed. Do not depend on in production. |

---

## Core Packages

These are the foundation. Everything else builds on them.

| Package | Description | Lines | Tests |
|---------|-------------|-------|-------|
| `@shipgate/cli` | CLI — scan, verify, gate, provenance, heal | 25k+ | Yes |
| `@isl-lang/core` | Evidence, pipeline, policies, fs-guard | 15k+ | Yes |
| `@isl-lang/gate` | Gate engine, specless adapters, trust scoring | 5k+ | Yes |
| `@isl-lang/isl-verify` | Verification runner, compliance, runtime verifier | 8k+ | Yes |
| `@isl-lang/isl-core` | Lexer, AST, check, format, lint | 4k+ | Yes |
| `@isl-lang/parser` | ISL recursive descent parser | 3k+ | Yes |
| `@isl-lang/pipeline` | Verification pipeline, semantic rules | 4k+ | Yes |
| `@isl-lang/verify-pipeline` | Incremental verification, cache, change detection | 3k+ | Yes |
| `@isl-lang/code-provenance` | Line-level AI attribution engine | 1.8k+ | Yes |
| `@isl-lang/proof` | Proof bundles, manifests, provenance | 5k+ | Yes |
| `@isl-lang/typechecker` | ISL type system | 2k+ | Yes |

## Stable Packages

Ship value today. APIs may evolve.

| Package | Description |
|---------|-------------|
| `@isl-lang/expression-evaluator` | Static analysis for ISL expressions |
| `@isl-lang/hallucination-scanner` | Detects phantom APIs, hallucinated imports |
| `@isl-lang/security-scanner` | Deep security analysis |
| `@isl-lang/spec-assist` | AI spec generation (Anthropic, OpenAI) |
| `@isl-lang/truthpack-v2` | Canonical project reality snapshot |
| `@isl-lang/isl-pbt` | Property-based testing from ISL |
| `@isl-lang/fuzzer` | Fuzz testing strategies |
| `@isl-lang/verifier-runtime` | Runtime verification engine |
| `@isl-lang/verifier-chaos` | Chaos injection testing |
| `@isl-lang/verifier-temporal` | Temporal trace verification |
| `@isl-lang/isl-smt` | SMT solver integration |
| `@isl-lang/effect-system` | Algebraic effect handlers |
| `@isl-lang/evidence-html` | HTML evidence reports |
| `@isl-lang/lsp-core` | Language server protocol core |
| `@isl-lang/lsp-server` | ISL language server |
| `@isl-lang/mcp-server` | Model Context Protocol server |
| `@isl-lang/github-action-gate` | GitHub Action for CI gating |
| `@isl-lang/vscode-islstudio` | VS Code extension |
| `@isl-lang/secrets-hygiene` | Secret detection and validation |
| `@isl-lang/observability` | OpenTelemetry integration |
| `@shipgate/sdk` | TypeScript SDK |
| `@isl-lang/sdk-web` | Browser SDK with hooks |
| `@isl-lang/contract-test-gen` | Contract test generation |
| `@isl-lang/api-server` | REST API server |

## Stable SDKs

| Package | Language | Status |
|---------|----------|--------|
| `sdk-typescript` | TypeScript | Stable |
| `sdk-web` | TypeScript/Browser | Stable |
| `sdk-react-native` | TypeScript/RN | Stable |
| `sdk-python` | Python | Stable |
| `sdk-flutter` | Dart | Stable |
| `sdk-kotlin` | Kotlin | Stable |
| `sdk-swift` | Swift | Stable |

## Stable Stdlib

| Package | Domain |
|---------|--------|
| `stdlib-auth` | JWT, password, session, RBAC |
| `stdlib-billing` | Subscriptions, invoices, Stripe |
| `stdlib-core` | Primitives, IDs, geo, validation |
| `stdlib-files` | Storage, upload, download |
| `stdlib-idempotency` | Idempotent operations |
| `stdlib-messaging` | Queue, dead-letter, patterns |
| `stdlib-notifications` | Email, SMS, push channels |
| `stdlib-realtime` | WebSocket, SSE, channels |
| `stdlib-audit` | Audit logging, compliance |
| `stdlib-search` | Full-text, faceted search |
| `stdlib-workflow` | Workflow orchestration |

## Stable Codegen

| Package | Target |
|---------|--------|
| `codegen-openapi` | OpenAPI spec generation |
| `codegen-go` | Go code generation |
| `codegen-rust` | Rust code generation |
| `codegen-python` | Python code generation |
| `codegen-csharp` | C# code generation |
| `codegen-graphql` | GraphQL schema generation |
| `codegen-grpc` | gRPC/Protobuf generation |
| `codegen-jvm` | JVM (Java/Kotlin) generation |
| `codegen-terraform` | Terraform HCL generation |
| `codegen-loadtest` | K6, Artillery, Gatling tests |
| `codegen-wasm` | WebAssembly generation |

## Beta Packages

Functional but incomplete. Expect gaps.

| Package | Description | Notes |
|---------|-------------|-------|
| `stdlib-distributed` | Actor model, saga, service mesh | Types defined, thin impl |
| `stdlib-queue` | Queue abstractions | Types defined, thin impl |
| `stdlib-database` | Database abstractions | Single file |
| `stdlib-time` | Time/duration utilities | Single file |
| `codegen-k8s` | Kubernetes manifests | Types only |
| `codegen-kubernetes` | Kubernetes + Helm | Manifests, Helm templates |
| `codegen-edge` | Edge runtime code | Thin generator |
| `codegen-client` | Multi-language API clients | TS/Python/Go stubs |
| `codegen-sdk` | SDK generation | Thin generator |
| `codegen-docs` | Documentation generation | Mostly types |
| `compliance` | Compliance framework | Templates present, impl TODO |
| `isl-policy-engine` | Policy engine | Functional, evolving |
| `registry-client` | Package registry client | Single file |
| `create-shipgate-check` | Custom check scaffold | Template |
| `isl-verify-action` | GitHub Action wrapper | Thin wrapper |
| `agent-os` | Agent runtime | 2 files, early |

## Experimental

Early exploration. May be removed or significantly rearchitected.

| Package | Description | Status |
|---------|-------------|--------|
| `stdlib-ai` | AI/ML abstractions | Empty (`export {}`) |
| `stdlib-scheduling` | Scheduling abstractions | Empty (`export {}`) |
| `stdlib-ml` | ML contracts | Thin |
| `stdlib-events` | Event abstractions | Minimal |
| `stdlib-http` | HTTP abstractions | Minimal |
| `stdlib-api` | API abstractions | Minimal |
| `stdlib-runtime` | Runtime abstractions | Minimal, TODO |
| `ci-docker` | Docker CI images | Empty (`export {}`) |
| `audit-viewer` | Audit log viewer | Empty (`export {}`) |
| `playground` | ISL playground | Empty (`export {}`) |
| `marketplace-web` | Pack marketplace | Empty (`export {}`) |
| `marketplace-api` | Pack marketplace API | Minimal |

---

## Contributing

When adding a new package:
1. Start at **Experimental** tier
2. Add an entry to this file
3. Graduate to **Beta** when it has types, a real index.ts, and a README
4. Graduate to **Stable** when it has tests and is used by at least one other package
5. Graduate to **Core** when it's critical path for the CLI or dashboard
