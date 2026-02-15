# Package visibility: public vs private

Recommendation for which `@isl-lang/*` packages to **publish to npm** (public) vs keep **private** (monorepo-only).

---

## Public (publish to npm)

These are libraries/SDKs that external users or tools would install. Publish them when versions and APIs are stable.

### Already in publish script (keep public)
- `@isl-lang/parser` – ISL parser
- `@isl-lang/errors` – Error types
- `@isl-lang/typechecker` – Semantic analysis
- `@isl-lang/evaluator` – Evaluation engine
- `@isl-lang/lsp-core` – LSP shared code
- `@isl-lang/lsp-server` – Language Server
- `@isl-lang/repl` – Interactive REPL

### Core language / toolchain (recommend public)
- `@isl-lang/isl-core` – Parser, typechecker, formatter, linter, verification (unified core)
- `@isl-lang/core` – Translator and corpus utilities
- `@isl-lang/import-resolver` – Import resolution and bundling
- `@isl-lang/semantics` – Versioned semantics for operators/clauses

### Verification
- `@isl-lang/verifier-runtime` – Runtime verification engine
- `@isl-lang/verifier` – Evidence-first verification engine
- `@isl-lang/verifier-temporal` – Temporal properties
- `@isl-lang/verifier-security` – Security verifier
- `@isl-lang/verifier-formal` – Formal (SMT) verification
- `@isl-lang/verifier-chaos` – Chaos engineering verifier
- `@isl-lang/trust-score` – Trust scoring / SHIP–NO-SHIP
- `@isl-lang/prover` – Prover
- `@isl-lang/verified-build` – Single-package verified-build SDK

### Pipeline / proof / verify
- `@isl-lang/pipeline` – ISL pipeline
- `@isl-lang/proof` – Proof
- `@isl-lang/isl-verify` – Verify runner
- `@isl-lang/verify-pipeline` – Verify pipeline

### Runtimes and execution
- `@isl-lang/runtime-universal` – Universal runtime
- `@isl-lang/runtime-verify` – Runtime verification helpers
- `@isl-lang/runtime-sdk` – SDK for embedding verification
- `@isl-lang/isl-runtime` – ISL runtime
- `@isl-lang/test-runtime` – Test runtime (isl-test-runtime)
- `@isl-lang/test-runtime-legacy` – Legacy test runtime

### Gate / scoring
- `@isl-lang/gate` – Gating and scoring (if you want external tools to use it)

### Stdlib (registry + modules)
- `@isl-lang/isl-stdlib` – Stdlib registry
- `@isl-lang/stdlib-core` – Core types/validations
- `@isl-lang/stdlib-http` – HTTP/REST
- `@isl-lang/stdlib-database` – Database
- `@isl-lang/stdlib-auth` – Auth
- `@isl-lang/stdlib-cache` – Cache
- `@isl-lang/stdlib-events` – Events
- `@isl-lang/stdlib-queue` – Queues
- `@isl-lang/stdlib-observability` – Logging/metrics/tracing
- `@isl-lang/stdlib-api` – API patterns
- `@isl-lang/stdlib-runtime` – Runtime implementations
- Other `stdlib-*` that expose stable, documented APIs (billing, payments, workflow, etc.)

### SDKs (when stable)
- `@isl-lang/sdk-typescript` – TypeScript SDK
- `@isl-lang/sdk-web` – Browser SDK
- `@isl-lang/sdk-react-native` – React Native SDK

### Testing / simulation
- `@isl-lang/test-generator` – Test generation
- `@isl-lang/snapshot-testing` – Snapshot testing
- `@isl-lang/simulator` – Domain simulator

### Evidence / schema
- `@isl-lang/evidence-schema` – Evidence types/schema

### Optional (publish when ready)
- `@isl-lang/language-server` – If distinct from lsp-server
- `@isl-lang/expression-evaluator` – If part of public contract
- `@isl-lang/trace-format` – Trace format
- `@isl-lang/codegen` + `@isl-lang/codegen-core` + `@isl-lang/codegen-types` – If you want external codegen usage

---

## Private (do not publish)

Keep these **private** so they are only used inside the monorepo.

### Apps and UIs
- `@isl-lang/dashboard-web`, `@isl-lang/dashboard-api`
- `@isl-lang/marketplace-web`, `@isl-lang/marketplace-api`
- `@isl-lang/playground`, `@isl-lang/visual-editor`
- `@isl-lang/shipgate`, `@isl-lang/trace-viewer`, `@isl-lang/audit-viewer`
- `@isl-lang/docs`, `@isl-lang/docs-advanced`

### IDE extensions
- `@isl-lang/vscode`, `@isl-lang/jetbrains`  
  (Publish later from separate release flow if desired.)

### CI / DevOps / integrations
- `@isl-lang/github-action`, `@isl-lang/github-action-gate`, `@isl-lang/github-app`
- `@isl-lang/slack-bot`
- `@isl-lang/sentry`, `@isl-lang/datadog`, `@isl-lang/grafana`, `@isl-lang/prometheus`
- `@isl-lang/opentelemetry`, `@isl-lang/distributed-tracing`

### Internal / experimental / AI
- `@isl-lang/agent-os`, `@isl-lang/ai-copilot`, `@isl-lang/ai-generator`
- `@isl-lang/isl-ai`, `@isl-lang/spec-assist`, `@isl-lang/spec-reviewer`, `@isl-lang/inference`

### Governance / internal tooling
- `@isl-lang/firewall` – Agent file-write governance (publish later if needed)
- `@isl-lang/private-registry` – Internal by name and purpose
- `@isl-lang/mcp-server` – Optional public later

### Implementation detail / build / tooling
- `@isl-lang/cli` – Excluded from publish due to deps; keep private until fixed
- `@isl-lang/build-runner`, `@isl-lang/autofix`, `@isl-lang/patch-engine`
- `@isl-lang/versioner`, `@isl-lang/migrations`, `@isl-lang/migration-tools`
- `@isl-lang/diff-viewer`, `@isl-lang/evidence-html` (unless you want to expose HTML generation)

### Codegen backends (keep private unless you want per-language packages)
- All `@isl-lang/codegen-*` except `codegen`, `codegen-core`, `codegen-types` if you add them to public list above

### Other internal libraries
- `@isl-lang/registry-client` – Registry client (internal)
- `@isl-lang/runtime`, `@isl-lang/interpreter`, `@isl-lang/runtime-interpreter` – Keep private if they are internal implementations; make public only if you want them as standalone entry points
- Packages that are only used as dependencies by other monorepo packages and not intended as standalone products

---

## Summary

| Category              | Recommendation |
|-----------------------|----------------|
| **Already published**| Keep public (parser, errors, typechecker, evaluator, lsp-core, lsp-server, repl) |
| **Core + verification + pipeline** | Make public when stable |
| **Stdlibs**           | Make public when APIs are stable and documented |
| **SDKs**              | Make public when ready for external use |
| **Apps, UIs, IDE**    | Keep private |
| **CI, Slack, observability** | Keep private |
| **Internal/experimental** | Keep private until you decide to support them as products |

When you add a package to the **public** list:
1. Remove `"private": true` from its `package.json`.
2. Add it to `PUBLISH_ORDER` in `scripts/publish.ts` in **dependency order** (dependencies first).
3. Add `"publishConfig": { "access": "public" }` if using a scoped org on npm.
4. Use Changesets for version bumps and run the normal release flow.
