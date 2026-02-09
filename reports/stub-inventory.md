# Stub Inventory Report

Generated: 2026-02-09T15:55:28.001Z

## Summary

- **Total Packages Analyzed:** 224
- **Stubbed Packages:** 61
- **Tier 1 (Blocks Adoption):** 7
- **Tier 2 (Platform Moats):** 5
- **Tier 3 (Breadth):** 49

## Priority Order (by Priority Score)

### @isl-lang/policy-packs

**Path:** `packages\isl-policy-packs`
**Tier:** Tier 2
**Stub Score:** 100/100
**Integration Score:** 50/100
**User-Facing Score:** 0/100
**Priority Score:** 65.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ✅ No

**Upstream Dependents:** shipgate, @isl-lang/github-app, @isl-lang/isl-policy-engine, @isl-lang/islstudio, @isl-lang/verified-build

**Stub Evidence (5 found):**

- `packages\isl-policy-packs\src\explain.ts:522` - CRITICAL: throw-not-implemented
  ```
  'throw new Error("Not implemented")',
  ```
- `packages\isl-policy-packs\src\explain.ts:536` - CRITICAL: throw-not-implemented
  ```
  throw new Error('Not implemented');
  ```
- `packages\isl-policy-packs\src\explain.ts:570` - CRITICAL: throw-not-implemented
  ```
  throw new Error('Not implemented');
  ```
- `packages\isl-policy-packs\src\explain.ts:523` - CRITICAL: throw-todo
  ```
  'throw new Error("TODO")',
  ```
- `packages\isl-policy-packs\src\explain.ts:524` - CRITICAL: throw-stub
  ```
  'throw new Error("STUB") or "PLACEHOLDER"',
  ```

**Recommended Actions:**
- Replace all stub implementations with real logic
- Fix 5 critical stub(s) (throw "Not implemented")
- Ensure compatibility with 5 dependent package(s)

---

### @isl-lang/generator

**Path:** `packages\isl-generator`
**Tier:** Tier 3
**Stub Score:** 60/100
**Integration Score:** 70/100
**User-Facing Score:** 0/100
**Priority Score:** 51.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ✅ No

**Upstream Dependents:** @isl-lang/autofix, @isl-lang/pipeline, @isl-lang/proof, @isl-lang/verify-pipeline, @isl-lang/sdk-react-native, @isl-lang/sdk-typescript, @isl-lang/sdk-web

**Stub Evidence (2 found):**

- `packages\isl-generator\src\generator.ts:185` - CRITICAL: throw-not-implemented
  ```
  throw new Error('Not implemented');
  ```
- `packages\isl-generator\src\generator.ts:243` - CRITICAL: throw-not-implemented
  ```
  throw new Error('Not implemented');
  ```

**Recommended Actions:**
- Replace all stub implementations with real logic
- Add test suite (unit + integration tests)
- Fix 2 critical stub(s) (throw "Not implemented")
- Ensure compatibility with 7 dependent package(s)

---

### @isl-lang/pipeline

**Path:** `packages\isl-pipeline`
**Tier:** Tier 1
**Stub Score:** 60/100
**Integration Score:** 30/100
**User-Facing Score:** 20/100
**Priority Score:** 43.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** shipgate, @isl-lang/github-app, @isl-lang/trace-format

**Stub Evidence (2 found):**

- `packages\isl-pipeline\src\semantic-healer.ts:283` - CRITICAL: throw-not-implemented
  ```
  // Replace "throw new Error('Not implemented')" with real skeleton
  ```
- `packages\isl-pipeline\src\semantic-rules.ts:699` - CRITICAL: throw-not-implemented
  ```
  // Pattern 1: throw new Error('Not implemented') and variations
  ```

**Recommended Actions:**
- Replace all stub implementations with real logic
- Implement core exports and functionality
- Fix 2 critical stub(s) (throw "Not implemented")
- Ensure compatibility with 3 dependent package(s)

---

### @isl-lang/parser

**Path:** `packages\parser`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 100/100
**User-Facing Score:** 20/100
**Priority Score:** 34.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/agent-os, @isl-lang/build-runner, shipgate, @isl-lang/codegen-csharp, @isl-lang/codegen-go, @isl-lang/codegen-graphql, @isl-lang/codegen-grpc, @isl-lang/codegen-harness, @isl-lang/codegen-openapi, @isl-lang/codegen-python, @isl-lang/codegen-python-advanced, @isl-lang/codegen-runtime, @isl-lang/codegen-terraform, @isl-lang/codegen-tests, @isl-lang/core, @isl-lang/docs-advanced, @isl-lang/error-catalog, @isl-lang/evaluator, @isl-lang/expression-compiler, @isl-lang/graphql-codegen, @isl-lang/import-resolver, @isl-lang/intent-translator, @isl-lang/interpreter, @isl-lang/isl-compiler, @isl-lang/isl-core, @isl-lang/isl-coverage, @isl-lang/isl-discovery, @isl-lang/static-analyzer, @isl-lang/gate, @isl-lang/pbt, @isl-lang/proof, @isl-lang/semantic-analysis, @isl-lang/isl-verify, @isl-lang/verify-pipeline, @isl-lang/java-resolver, @isl-lang/lsp-core, @isl-lang/lsp-server, @isl-lang/mcp-server, @isl-lang/reality-probe, @isl-lang/repl, @shipgate/sdk, @isl-lang/sdk-typescript, @isl-lang/simulator, @isl-lang/spec-assist, @isl-lang/spec-federation, @isl-lang/stdlib-payments, @isl-lang/stdlib-scheduling, @isl-lang/test-generator, @isl-lang/typechecker, @isl-lang/verifier, @isl-lang/verifier-runtime

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 51 dependent package(s)

---

### @isl-lang/core

**Path:** `packages\core`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 100/100
**User-Facing Score:** 0/100
**Priority Score:** 30.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/agent-os, @isl-lang/ai-generator, @isl-lang/api-gateway, @isl-lang/api-generator, @isl-lang/autofix, shipgate, @isl-lang/codegen-client, @isl-lang/codegen-db, @isl-lang/codegen-edge, @isl-lang/codegen-grpc, @isl-lang/codegen-jvm, @isl-lang/codegen-migrations, @isl-lang/codegen-mocks, @isl-lang/codegen-pipelines, @isl-lang/codegen-property-tests, @isl-lang/codegen-terraform, @isl-lang/codegen-types, @isl-lang/codegen-ui, @isl-lang/codegen-validators, @isl-lang/codegen-wasm, @isl-lang/comparator, @isl-lang/compliance, @isl-lang/contract-testing, @isl-lang/contracts, @isl-lang/coverage, @isl-lang/db-generator, @isl-lang/dependency-analyzer, @isl-lang/diff-viewer, @isl-lang/distributed, @isl-lang/effect-system, @isl-lang/env-reality-checker, @isl-lang/event-sourcing, @isl-lang/formal-verification, @isl-lang/generator-sdk, @isl-lang/github-action, @isl-lang/health-check, @isl-lang/inference, @isl-lang/intent-translator, @isl-lang/isl-ai, @isl-lang/isl-cli, @isl-lang/isl-federation, @isl-lang/gate-action, @isl-lang/isl-lsp, @isl-lang/pipeline, @isl-lang/proof, @isl-lang/isl-runtime, @isl-lang/semantic-analysis, @isl-lang/isl-smt, @isl-lang/verify-pipeline, @isl-lang/language-server, @isl-lang/lsp, @isl-lang/lsp-server, @isl-lang/migration-tools, @isl-lang/migrations, @isl-lang/mock-server, @isl-lang/multi-tenant, @isl-lang/mutation-testing, @isl-lang/runtime-sdk, @isl-lang/runtime-universal, @shipgate/sdk, @isl-lang/security-scanner, @isl-lang/security-verifier-enhancer, @isl-lang/simulator, @isl-lang/spec-reviewer, @isl-lang/state-machine, @isl-lang/stdlib-ai, @isl-lang/stdlib-cache, @isl-lang/stdlib-email, @isl-lang/stdlib-events, @isl-lang/stdlib-messaging, @isl-lang/stdlib-notifications, @isl-lang/stdlib-observability, @isl-lang/stdlib-queue, @isl-lang/stdlib-realtime, @isl-lang/stdlib-search, @isl-lang/stdlib-workflow, @isl-lang/streaming, @isl-lang/truthpack-v2, @isl-lang/ui-generator, @isl-lang/verifier-chaos, @isl-lang/verifier-formal, @isl-lang/verifier-security, @isl-lang/verifier-temporal, @isl-lang/versioner

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality
- Ensure compatibility with 84 dependent package(s)

---

### @isl-lang/isl-core

**Path:** `packages\isl-core`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 100/100
**User-Facing Score:** 0/100
**Priority Score:** 30.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/agent-os, @isl-lang/ai-generator, @isl-lang/api-gateway, @isl-lang/api-generator, @isl-lang/autofix, shipgate, @isl-lang/codegen-client, @isl-lang/codegen-db, @isl-lang/codegen-edge, @isl-lang/codegen-grpc, @isl-lang/codegen-jvm, @isl-lang/codegen-migrations, @isl-lang/codegen-mocks, @isl-lang/codegen-pipelines, @isl-lang/codegen-property-tests, @isl-lang/codegen-terraform, @isl-lang/codegen-types, @isl-lang/codegen-ui, @isl-lang/codegen-validators, @isl-lang/codegen-wasm, @isl-lang/comparator, @isl-lang/compliance, @isl-lang/contract-testing, @isl-lang/contracts, @isl-lang/coverage, @isl-lang/db-generator, @isl-lang/dependency-analyzer, @isl-lang/diff-viewer, @isl-lang/distributed, @isl-lang/effect-system, @isl-lang/event-sourcing, @isl-lang/formal-verification, @isl-lang/generator-sdk, @isl-lang/health-check, @isl-lang/inference, @isl-lang/intent-translator, @isl-lang/isl-ai, @isl-lang/isl-cli, @isl-lang/isl-federation, @isl-lang/isl-lsp, @isl-lang/pipeline, @isl-lang/proof, @isl-lang/isl-runtime, @isl-lang/semantic-analysis, @isl-lang/isl-smt, @isl-lang/verify-pipeline, @isl-lang/language-server, @isl-lang/lsp, @isl-lang/migration-tools, @isl-lang/migrations, @isl-lang/mock-server, @isl-lang/multi-tenant, @isl-lang/mutation-testing, @isl-lang/runtime-sdk, @isl-lang/runtime-universal, @isl-lang/security-scanner, @isl-lang/simulator, @isl-lang/spec-reviewer, @isl-lang/state-machine, @isl-lang/stdlib-cache, @isl-lang/stdlib-email, @isl-lang/stdlib-messaging, @isl-lang/stdlib-notifications, @isl-lang/streaming, @isl-lang/ui-generator, @isl-lang/verifier-chaos, @isl-lang/verifier-formal, @isl-lang/verifier-security, @isl-lang/verifier-temporal, @isl-lang/versioner

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 70 dependent package(s)

---

### @isl-lang/healer

**Path:** `packages\isl-healer`
**Tier:** Tier 3
**Stub Score:** 60/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 30.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ✅ No

**Stub Evidence (2 found):**

- `packages\isl-healer\src\rules\ast-semantic-rules.ts:767` - CRITICAL: throw-not-implemented
  ```
  // Pattern 1: throw new Error('Not implemented') variants
  ```
- `packages\isl-healer\src\rules\deterministic-recipes.ts:926` - CRITICAL: throw-not-implemented
  ```
  // Pattern 1: Replace "throw new Error('Not implemented')" with proper TODO
  ```

**Recommended Actions:**
- Replace all stub implementations with real logic
- Fix 2 critical stub(s) (throw "Not implemented")

---

### @isl-lang/isl-verify

**Path:** `packages\isl-verify`
**Tier:** Tier 1
**Stub Score:** 0/100
**Integration Score:** 90/100
**User-Facing Score:** 0/100
**Priority Score:** 27.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/agent-os, shipgate, @isl-lang/comparator, @isl-lang/compliance, @isl-lang/github-action, @isl-lang/isl-cli, @isl-lang/gate, @isl-lang/mcp-server, @isl-lang/slack-bot

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality
- Ensure compatibility with 9 dependent package(s)

---

### @isl-lang/generator-sdk

**Path:** `packages\generator-sdk`
**Tier:** Tier 3
**Stub Score:** 30/100
**Integration Score:** 30/100
**User-Facing Score:** 0/100
**Priority Score:** 24.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ✅ No

**Upstream Dependents:** @isl-lang/sdk-react-native, @isl-lang/sdk-typescript, @isl-lang/sdk-web

**Stub Evidence (1 found):**

- `packages\generator-sdk\src\cli\scaffold.ts:469` - CRITICAL: throw-not-implemented
  ```
  throw new Error('Not implemented');
  ```

**Recommended Actions:**
- Fix 1 critical stub(s) (throw "Not implemented")
- Ensure compatibility with 3 dependent package(s)

---

### @isl-lang/test-generator

**Path:** `packages\test-generator`
**Tier:** Tier 3
**Stub Score:** 30/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 18.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ✅ No

**Upstream Dependents:** @isl-lang/verify-pipeline

**Stub Evidence (1 found):**

- `packages\test-generator\src\generator.ts:528` - CRITICAL: throw-not-implemented
  ```
  throw new Error('Not implemented');
  ```

**Recommended Actions:**
- Fix 1 critical stub(s) (throw "Not implemented")
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/github-app

**Path:** `packages\github-app`
**Tier:** Tier 3
**Stub Score:** 30/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 15.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ✅ No

**Stub Evidence (1 found):**

- `packages\github-app\src\services\policy.ts:84` - CRITICAL: throw-not-implemented
  ```
  throw new Error('Not implemented');
  ```

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Fix 1 critical stub(s) (throw "Not implemented")

---

### @isl-lang/isl-compiler

**Path:** `packages\isl-compiler`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 40/100
**User-Facing Score:** 0/100
**Priority Score:** 12.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/agent-os, @isl-lang/build-runner, @isl-lang/isl-cli, @isl-lang/security-verifier-enhancer

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 4 dependent package(s)

---

### shipgate-isl

**Path:** `packages\vscode`
**Tier:** Tier 1
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 60/100
**Priority Score:** 12.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ❌
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/codegen-client

**Path:** `packages\codegen-client`
**Tier:** Tier 1
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 50/100
**Priority Score:** 10.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/semantic-analysis

**Path:** `packages\isl-semantic-analysis`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 30/100
**User-Facing Score:** 0/100
**Priority Score:** 9.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** shipgate, @isl-lang/security-verifier-enhancer, @isl-lang/spec-assist

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 3 dependent package(s)

---

### vscode-islstudio

**Path:** `packages\vscode-islstudio`
**Tier:** Tier 1
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 40/100
**Priority Score:** 8.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ❌
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/import-resolver

**Path:** `packages\import-resolver`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 20/100
**User-Facing Score:** 0/100
**Priority Score:** 6.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** shipgate, @isl-lang/verify-pipeline

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 2 dependent package(s)

---

### @isl-lang/trace-viewer

**Path:** `packages\trace-viewer`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 20/100
**User-Facing Score:** 0/100
**Priority Score:** 6.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ❌
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/isl-cli, @isl-lang/test-runtime

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality
- Ensure compatibility with 2 dependent package(s)

---

### @isl-lang/verifier-sandbox

**Path:** `packages\verifier-sandbox`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 20/100
**Priority Score:** 4.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/codegen-docs

**Path:** `packages\codegen-docs`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/codegen

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/codegen-mocks

**Path:** `packages\codegen-mocks`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/codegen

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/codegen-openapi

**Path:** `packages\codegen-openapi`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/codegen

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/codegen-validators

**Path:** `packages\codegen-validators`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/codegen

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/docs

**Path:** `packages\docs`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ❌
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/codegen

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/isl-ai

**Path:** `packages\isl-ai`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/isl-cli

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/policy-engine

**Path:** `packages\policy-engine`
**Tier:** Tier 2
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** shipgate

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/reality-probe

**Path:** `packages\reality-probe`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** shipgate

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/runtime-interpreter

**Path:** `packages\runtime-interpreter`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/interpreter

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/secrets-hygiene

**Path:** `packages\secrets-hygiene`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ❌
- Has README: ❌
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** shipgate

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Create README.md with usage examples
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/stdlib-auth

**Path:** `packages\stdlib-auth`
**Tier:** Tier 2
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** @isl-lang/stdlib-saas

**Recommended Actions:**
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/truthpack-v2

**Path:** `packages\truthpack-v2`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 10/100
**User-Facing Score:** 0/100
**Priority Score:** 3.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Upstream Dependents:** shipgate

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality
- Ensure compatibility with 1 dependent package(s)

---

### @isl-lang/ai-copilot

**Path:** `packages\ai-copilot`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/api-versioning

**Path:** `packages\api-versioning`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/circuit-breaker

**Path:** `packages\circuit-breaker`
**Tier:** Tier 1
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/codegen-edge

**Path:** `packages\codegen-edge`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/codegen-k8s

**Path:** `packages\codegen-k8s`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/codegen-kubernetes

**Path:** `packages\codegen-kubernetes`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/codegen-migrations

**Path:** `packages\codegen-migrations`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/codegen-sdk

**Path:** `packages\codegen-sdk`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/codegen-wasm

**Path:** `packages\codegen-wasm`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/diff-viewer

**Path:** `packages\diff-viewer`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ❌
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/distributed

**Path:** `packages\distributed`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/distributed-tracing

**Path:** `packages\distributed-tracing`
**Tier:** Tier 1
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/effect-handlers

**Path:** `packages\effect-handlers`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/effect-system

**Path:** `packages\effect-system`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/env-reality-checker

**Path:** `packages\env-reality-checker`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/error-catalog

**Path:** `packages\error-catalog`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/feature-flags

**Path:** `packages\feature-flags`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/grafana

**Path:** `packages\grafana`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/adapters

**Path:** `packages\isl-adapters`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/isl-federation

**Path:** `packages\isl-federation`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/java-resolver

**Path:** `packages\java-resolver`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/language-server

**Path:** `packages\language-server`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/mutation-testing

**Path:** `packages\mutation-testing`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/private-registry

**Path:** `packages\private-registry`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/runtime-universal

**Path:** `packages\runtime-universal`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/schema-evolution

**Path:** `packages\schema-evolution`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/sdk-react-native

**Path:** `packages\sdk-react-native`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ✅
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Implement core exports and functionality

---

### @isl-lang/stdlib-distributed

**Path:** `packages\stdlib-distributed`
**Tier:** Tier 2
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ✅
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/stdlib-time

**Path:** `packages\stdlib-time`
**Tier:** Tier 2
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ❌
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

### @isl-lang/visual-editor

**Path:** `packages\visual-editor`
**Tier:** Tier 3
**Stub Score:** 0/100
**Integration Score:** 0/100
**User-Facing Score:** 0/100
**Priority Score:** 0.0/100

**Status:**
- Has Tests: ❌
- Has README: ✅
- Has Exports: ❌
- Is Empty: ⚠️ Yes

**Recommended Actions:**
- Add test suite (unit + integration tests)
- Implement core exports and functionality

---

