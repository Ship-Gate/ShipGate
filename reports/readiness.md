# Package Readiness Report

**Generated:** 2026-02-09T16:30:16.756Z
**Threshold:** 75%
**Total:** 224 | **Ready:** 136 | **Not Ready:** 88

## Scoreboard

| Package | Tier | Score | Build | TC | Test | Docs | Cov | Exports | Perf | Sec | Ready |
|---------|------|-------|-------|----|------|------|-----|---------|------|-----|-------|
| @isl-lang/cli-ux | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/errors | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/evaluator | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/evidence-schema | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/import-resolver | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/static-analyzer | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/pipeline | production | 88% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | **YES** |
| @isl-lang/isl-stdlib | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/parser | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-analytics | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-core | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-idempotency | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-payments | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-rate-limit | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-workflow | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/typechecker | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/verifier-runtime | production | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/build-runner | production | 75% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | **YES** |
| @isl-lang/codegen-core | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-types | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/evidence-html | production | 75% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | **YES** |
| @isl-lang/isl-core | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/lsp-core | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/lsp-server | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/repl | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-billing | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-cache | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-files | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-messaging | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-notifications | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-scheduling | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/verified-build | production | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen | production | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/codegen-openapi | production | 63% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | no |
| @isl-lang/codegen-tests | production | 63% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | no |
| @isl-lang/isl-verify | production | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/language-server | production | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/semantics | production | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-auth | production | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/codegen-graphql | production | 50% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | no |
| @isl-lang/codegen-python | production | 50% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | no |
| @isl-lang/codegen-runtime | production | 50% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ❌ | no |
| @isl-lang/codegen-jvm | partial | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-audit | partial | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/autofix | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-csharp | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-go | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-rust | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/contract-testing | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/isl-smt | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/patch-engine | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/snapshot-testing | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-actors | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/stdlib-ai | partial | 75% | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | no |
| @isl-lang/verifier-chaos | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/verifier-formal | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/verifier-security | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/verifier-temporal | partial | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/test-runtime | partial | 63% | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/prover | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-api | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-database | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-email | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-events | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-http | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-observability | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-queue | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-realtime | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-saas | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-search | partial | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/test-generator | partial | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-distributed | partial | 50% | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/claims-verifier | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-grpc | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/error-catalog | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/expression-compiler | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/generator-sdk | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/health-check | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/mutation-testing | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/opentelemetry | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/security-policies | experimental | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/ai-generator | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/api-versioning | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/circuit-breaker | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-client | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-edge | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-kubernetes | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-loadtest | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-migrations | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-mocks | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-pipelines | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-property-tests | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-terraform | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-ui | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-validators | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-wasm | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/comparator | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/compliance | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/dashboard-api | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/datadog | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/dependency-analyzer | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/distributed-tracing | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/effects | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/feature-flags | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/fuzzer | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/github-action | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/grafana | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/intent-translator | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/interpreter | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/isl-ai | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/isl-federation | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/marketplace-api | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/mcp-server | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/migrations | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/multi-tenant | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/postconditions | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/prometheus | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/runtime-sdk | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/runtime-verify | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/sdk-react-native | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/sdk-typescript | experimental | 75% | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | no |
| @isl-lang/sentry | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/slack-bot | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/spec-assist | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/spec-reviewer | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/versioner | experimental | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/agent-os | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/ai-copilot | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/api-gateway | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/api-generator | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/codegen-db | experimental | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/codegen-docs | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/codegen-python-advanced | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/codegen-sdk | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/db-generator | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/distributed | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/edge-runtime | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/effect-system | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/formal-verification | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/github-action-gate | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/graphql-codegen | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/inference | experimental | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/migration-tools | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/mock-server | experimental | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/policy-engine | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/registry-client | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/runtime-universal | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/schema-evolution | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/sdk-web | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/security-scanner | experimental | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/spec-federation | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/state-machine | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-ml | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-time | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/streaming | experimental | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/event-sourcing | experimental | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/github-app | experimental | 50% | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/runtime-interpreter | experimental | 50% | ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/effect-handlers | experimental | 38% | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/core | internal | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/docs-advanced | internal | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/isl-compiler | internal | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/islstudio | internal | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/lsp | internal | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/runtime | internal | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/verifier | internal | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/contracts | internal | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/diff-viewer | internal | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/docs | internal | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/isl-cli | internal | 63% | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/isl-runtime | internal | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/audit-viewer | internal | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/dashboard-web | internal | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/marketplace-web | internal | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/playground | internal | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/trace-viewer | internal | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/visual-editor | internal | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| shipgate | unlisted | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/security-verifier-enhancer | unlisted | 88% | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-harness | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/codegen-k8s | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/coverage | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/db-reality-verifier | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/fake-success-ui-detector | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/hallucination-scanner | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/adapters | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/evidence | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/firewall | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/gate | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/healer | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/pbt | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/isl-policy-engine | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/policy-packs | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/proof | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/trace-format | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/verify-pipeline | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/mock-detector | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/observability | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/phantom-dependency-scanner | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/runtime-adapters | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @shipgate/sdk | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/simulator | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/solver-z3-wasm | unlisted | 75% | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | no |
| @isl-lang/stdlib-runtime | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/test-runtime-legacy | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/truthpack-v2 | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/ui-generator | unlisted | 75% | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | no |
| shipgate-isl | unlisted | 75% | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | **YES** |
| @isl-lang/env-reality-checker | unlisted | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/isl-coverage | unlisted | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/isl-discovery | unlisted | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/gate-action | unlisted | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/generator | unlisted | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/isl-lsp | unlisted | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/semantic-analysis | unlisted | 63% | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/translator | unlisted | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/java-resolver | unlisted | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/private-registry | unlisted | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/secrets-hygiene | unlisted | 63% | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/trust-score | unlisted | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/verifier-sandbox | unlisted | 63% | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| vscode-islstudio | unlisted | 63% | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/ci-docker | unlisted | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |
| @isl-lang/reality-probe | unlisted | 50% | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ | no |

## By Tier

### production (32/42 ready)

- **@isl-lang/cli-ux** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/errors** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/evaluator** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/evidence-schema** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/import-resolver** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/static-analyzer** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/pipeline** (88%) — missing: coverage: No coverage script or report
- **@isl-lang/isl-stdlib** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/parser** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-analytics** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-core** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-idempotency** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-payments** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-rate-limit** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-workflow** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/typechecker** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/verifier-runtime** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/build-runner** (75%) — missing: perf: No dedicated perf tests (advisory); security: Production package is marked private
- **@isl-lang/codegen-core** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-types** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/evidence-html** (75%) — missing: perf: No dedicated perf tests (advisory); security: Production package is marked private
- **@isl-lang/isl-core** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/lsp-core** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/lsp-server** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/repl** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-billing** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-cache** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-files** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-messaging** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-notifications** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-scheduling** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/verified-build** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-openapi** (63%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory); security: Production package is marked private
- **@isl-lang/codegen-tests** (63%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory); security: Production package is marked private
- **@isl-lang/isl-verify** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/language-server** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/semantics** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-auth** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-graphql** (50%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory); security: Production package is marked private
- **@isl-lang/codegen-python** (50%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory); security: Production package is marked private
- **@isl-lang/codegen-runtime** (50%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory); security: Production package is marked private

### partial (15/30 ready)

- **@isl-lang/codegen-jvm** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-audit** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/autofix** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-csharp** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-go** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-rust** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/contract-testing** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-smt** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/patch-engine** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/snapshot-testing** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-actors** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-ai** (75%) — missing: test: No test files found (*.test.ts / *.spec.ts); perf: No dedicated perf tests (advisory)
- **@isl-lang/verifier-chaos** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/verifier-formal** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/verifier-security** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/verifier-temporal** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/test-runtime** (63%) — missing: typecheck: Typecheck script is missing or stubbed; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/prover** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-api** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-database** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-email** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-events** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-http** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-observability** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-queue** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-realtime** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-saas** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-search** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/test-generator** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-distributed** (50%) — missing: typecheck: Typecheck script is missing or stubbed; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)

### experimental (53/87 ready)

- **@isl-lang/claims-verifier** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-grpc** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/error-catalog** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/expression-compiler** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/generator-sdk** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/health-check** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/mutation-testing** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/opentelemetry** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/security-policies** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/ai-generator** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/api-versioning** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/circuit-breaker** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-client** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-edge** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-kubernetes** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-loadtest** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-migrations** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-mocks** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-pipelines** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-property-tests** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-terraform** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-ui** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-validators** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-wasm** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/comparator** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/compliance** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/dashboard-api** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/datadog** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/dependency-analyzer** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/distributed-tracing** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/effects** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/feature-flags** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/fuzzer** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/github-action** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/grafana** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/intent-translator** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/interpreter** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-ai** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-federation** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/marketplace-api** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/mcp-server** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/migrations** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/multi-tenant** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/postconditions** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/prometheus** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/runtime-sdk** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/runtime-verify** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/sdk-react-native** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/sdk-typescript** (75%) — missing: test: No test files found (*.test.ts / *.spec.ts); perf: No dedicated perf tests (advisory)
- **@isl-lang/sentry** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/slack-bot** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/spec-assist** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/spec-reviewer** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/versioner** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/agent-os** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/ai-copilot** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/api-gateway** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/api-generator** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-db** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-docs** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-python-advanced** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-sdk** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/db-generator** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/distributed** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/edge-runtime** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/effect-system** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/formal-verification** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/github-action-gate** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/graphql-codegen** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/inference** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/migration-tools** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/mock-server** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/policy-engine** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/registry-client** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/runtime-universal** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/schema-evolution** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/sdk-web** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/security-scanner** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/spec-federation** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/state-machine** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-ml** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-time** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/streaming** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/event-sourcing** (50%) — missing: build: No dist/ — run build to verify; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/github-app** (50%) — missing: typecheck: Typecheck script is missing or stubbed; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/runtime-interpreter** (50%) — missing: typecheck: Typecheck script is missing or stubbed; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/effect-handlers** (38%) — missing: build: Build script is a stub/echo; typecheck: Typecheck script is missing or stubbed; test: Test script is missing or stubbed; coverage: No coverage script or report; perf: No performance validation

### internal (7/18 ready)

- **@isl-lang/core** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/docs-advanced** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-compiler** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/islstudio** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/lsp** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/runtime** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/verifier** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/contracts** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/diff-viewer** (63%) — missing: build: Build script is a stub/echo; coverage: No coverage script or report; perf: No performance validation
- **@isl-lang/docs** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-cli** (63%) — missing: typecheck: Typecheck script is missing or stubbed; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-runtime** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/audit-viewer** (50%) — missing: build: Build script is a stub/echo; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No performance validation
- **@isl-lang/dashboard-web** (50%) — missing: build: No dist/ — run build to verify; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/marketplace-web** (50%) — missing: build: Build script is a stub/echo; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No performance validation
- **@isl-lang/playground** (50%) — missing: build: Build script is a stub/echo; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No performance validation
- **@isl-lang/trace-viewer** (50%) — missing: build: Build script is a stub/echo; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No performance validation
- **@isl-lang/visual-editor** (50%) — missing: build: Build script is a stub/echo; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No performance validation

### unlisted (29/47 ready)

- **shipgate** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/security-verifier-enhancer** (88%) — missing: perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-harness** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/codegen-k8s** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/coverage** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/db-reality-verifier** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/fake-success-ui-detector** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/hallucination-scanner** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/adapters** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/evidence** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/firewall** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/gate** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/healer** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/pbt** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-policy-engine** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/policy-packs** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/proof** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/trace-format** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/verify-pipeline** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/mock-detector** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/observability** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/phantom-dependency-scanner** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/runtime-adapters** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@shipgate/sdk** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/simulator** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/solver-z3-wasm** (75%) — missing: build: No dist/ — run build to verify; perf: No dedicated perf tests (advisory)
- **@isl-lang/stdlib-runtime** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/test-runtime-legacy** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/truthpack-v2** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/ui-generator** (75%) — missing: build: No dist/ — run build to verify; perf: No dedicated perf tests (advisory)
- **shipgate-isl** (75%) — missing: coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/env-reality-checker** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-coverage** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-discovery** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/gate-action** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/generator** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/isl-lsp** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/semantic-analysis** (63%) — missing: typecheck: Typecheck script is missing or stubbed; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/translator** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/java-resolver** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/private-registry** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/secrets-hygiene** (63%) — missing: typecheck: Typecheck script is missing or stubbed; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/trust-score** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/verifier-sandbox** (63%) — missing: build: No dist/ — run build to verify; coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **vscode-islstudio** (63%) — missing: test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)
- **@isl-lang/ci-docker** (50%) — missing: build: Build script is a stub/echo; test: Test script is missing or stubbed; coverage: No coverage script or report; perf: No performance validation
- **@isl-lang/reality-probe** (50%) — missing: build: No dist/ — run build to verify; test: No test files found (*.test.ts / *.spec.ts); coverage: No coverage script or report; perf: No dedicated perf tests (advisory)

## Promotion Candidates

These packages meet all required gates and can be promoted:

- **@isl-lang/codegen-jvm** (partial → production, score 88%)
- **@isl-lang/stdlib-audit** (partial → production, score 88%)
- **@isl-lang/autofix** (partial → production, score 75%)
- **@isl-lang/codegen-csharp** (partial → production, score 75%)
- **@isl-lang/codegen-go** (partial → production, score 75%)
- **@isl-lang/codegen-rust** (partial → production, score 75%)
- **@isl-lang/contract-testing** (partial → production, score 75%)
- **@isl-lang/isl-smt** (partial → production, score 75%)
- **@isl-lang/patch-engine** (partial → production, score 75%)
- **@isl-lang/snapshot-testing** (partial → production, score 75%)
- **@isl-lang/stdlib-actors** (partial → production, score 75%)
- **@isl-lang/verifier-chaos** (partial → production, score 75%)
- **@isl-lang/verifier-formal** (partial → production, score 75%)
- **@isl-lang/verifier-security** (partial → production, score 75%)
- **@isl-lang/verifier-temporal** (partial → production, score 75%)
- **@isl-lang/claims-verifier** (experimental → production, score 88%)
- **@isl-lang/codegen-grpc** (experimental → production, score 88%)
- **@isl-lang/error-catalog** (experimental → production, score 88%)
- **@isl-lang/expression-compiler** (experimental → production, score 88%)
- **@isl-lang/generator-sdk** (experimental → production, score 88%)
- **@isl-lang/health-check** (experimental → production, score 88%)
- **@isl-lang/mutation-testing** (experimental → production, score 88%)
- **@isl-lang/opentelemetry** (experimental → production, score 88%)
- **@isl-lang/security-policies** (experimental → production, score 88%)
- **@isl-lang/ai-generator** (experimental → production, score 75%)
- **@isl-lang/api-versioning** (experimental → production, score 75%)
- **@isl-lang/circuit-breaker** (experimental → production, score 75%)
- **@isl-lang/codegen-client** (experimental → production, score 75%)
- **@isl-lang/codegen-edge** (experimental → production, score 75%)
- **@isl-lang/codegen-kubernetes** (experimental → production, score 75%)
- **@isl-lang/codegen-loadtest** (experimental → production, score 75%)
- **@isl-lang/codegen-migrations** (experimental → production, score 75%)
- **@isl-lang/codegen-mocks** (experimental → production, score 75%)
- **@isl-lang/codegen-pipelines** (experimental → production, score 75%)
- **@isl-lang/codegen-property-tests** (experimental → production, score 75%)
- **@isl-lang/codegen-terraform** (experimental → production, score 75%)
- **@isl-lang/codegen-ui** (experimental → production, score 75%)
- **@isl-lang/codegen-validators** (experimental → production, score 75%)
- **@isl-lang/codegen-wasm** (experimental → production, score 75%)
- **@isl-lang/comparator** (experimental → production, score 75%)
- **@isl-lang/compliance** (experimental → production, score 75%)
- **@isl-lang/dashboard-api** (experimental → production, score 75%)
- **@isl-lang/datadog** (experimental → production, score 75%)
- **@isl-lang/dependency-analyzer** (experimental → production, score 75%)
- **@isl-lang/distributed-tracing** (experimental → production, score 75%)
- **@isl-lang/effects** (experimental → production, score 75%)
- **@isl-lang/feature-flags** (experimental → production, score 75%)
- **@isl-lang/fuzzer** (experimental → production, score 75%)
- **@isl-lang/github-action** (experimental → production, score 75%)
- **@isl-lang/grafana** (experimental → production, score 75%)
- **@isl-lang/intent-translator** (experimental → production, score 75%)
- **@isl-lang/interpreter** (experimental → production, score 75%)
- **@isl-lang/isl-ai** (experimental → production, score 75%)
- **@isl-lang/isl-federation** (experimental → production, score 75%)
- **@isl-lang/marketplace-api** (experimental → production, score 75%)
- **@isl-lang/mcp-server** (experimental → production, score 75%)
- **@isl-lang/migrations** (experimental → production, score 75%)
- **@isl-lang/multi-tenant** (experimental → production, score 75%)
- **@isl-lang/postconditions** (experimental → production, score 75%)
- **@isl-lang/prometheus** (experimental → production, score 75%)
- **@isl-lang/runtime-sdk** (experimental → production, score 75%)
- **@isl-lang/runtime-verify** (experimental → production, score 75%)
- **@isl-lang/sdk-react-native** (experimental → production, score 75%)
- **@isl-lang/sentry** (experimental → production, score 75%)
- **@isl-lang/slack-bot** (experimental → production, score 75%)
- **@isl-lang/spec-assist** (experimental → production, score 75%)
- **@isl-lang/spec-reviewer** (experimental → production, score 75%)
- **@isl-lang/versioner** (experimental → production, score 75%)

Run: `npx tsx scripts/promote-package.ts <package-name>`
