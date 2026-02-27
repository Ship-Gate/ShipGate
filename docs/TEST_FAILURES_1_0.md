# Test Failures to Fix for 1.0 Green

This document lists every failing test (and related error) that must be fixed so `pnpm test:production` passes with no exclusions. Packages currently excluded from production test are listed with their specific failures.

---

## 1. @isl-lang/phantom-dependency-scanner

**Location:** `packages/phantom-dependency-scanner/`

### 1.1 Import Parser — named imports

- **File:** `tests/parser.test.ts`
- **Test:** `Import Parser > should parse named imports`
- **Error:** `expected [ 'debounce, throttle' ] to deeply equal [ 'debounce', 'throttle' ]`
- **Cause:** Parser returns a single symbol string `"debounce, throttle"` instead of splitting on comma. In `src/parser.ts`, for the pattern `import { ... } from '...'`, the capture group is the content inside `{}`; that string is being assigned as one symbol instead of splitting by comma and trimming.
- **Fix:** In `parseImports`, when parsing named imports `{ a, b }`, split the captured group by comma and trim each part to populate `symbols`.

### 1.2 Workspace detection — non-workspace project

- **File:** `tests/workspace.test.ts`
- **Test:** `Workspace Detection > should detect non-workspace project`
- **Error:** `expected true to be false` (i.e. `workspaceInfo.isPnpmWorkspace` is true for `valid-project`)
- **Cause:** `detectWorkspace(projectRoot)` for `valid-project` is returning `isPnpmWorkspace: true`; either the fixture is inside a monorepo and gets detected as workspace, or `detectWorkspace` logic treats the folder as a workspace (e.g. finds a pnpm-workspace.yaml upward).
- **Fix:** Ensure `valid-project` fixture has no `pnpm-workspace.yaml` (or that `detectWorkspace` only considers the given directory). If the test runs from repo root, the scanner may be finding the root workspace; scope detection to the provided `projectRoot` only.

---

## 2. @isl-lang/verifier-sandbox

**Location:** `packages/verifier-sandbox/`

### 2.1 SecretsMasker — JWT masking

- **File:** `src/sandbox.test.ts`
- **Test:** `Sandbox Runner > SecretsMasker > should mask JWT tokens`
- **Error:** `expected 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6Ik…' to contain '***'`
- **Cause:** `masker.mask(text)` is not masking the JWT; the string is returned unchanged.
- **Fix:** Implement or fix JWT masking in the secrets masker (e.g. detect Bearer + JWT and replace with `***`).

### 2.2 WorkerSandbox — execute simple commands

- **File:** `src/sandbox.test.ts`
- **Test:** `WorkerSandbox > should execute simple commands`
- **Error:** `expected false to be true` (`result.success`)
- **Cause:** Running a simple command (e.g. `node -v`) in the worker sandbox returns `success: false` (or stdout empty).
- **Fix:** Ensure worker execution path works (e.g. correct worker script, stdio capture, or no false-positive failure).

### 2.3 WorkerSandbox — enforce timeout

- **File:** `src/sandbox.test.ts`
- **Test:** `WorkerSandbox > should enforce timeout`
- **Error:** `expected false to be true` (`result.timedOut`)
- **Cause:** A long-running command is expected to set `timedOut: true` but it is false (command may finish or timeout not reported).
- **Fix:** Align timeout handling so that when the worker runs a long sleep/hang, the result has `timedOut: true`.

### 2.4 WorkerSandbox — filter environment variables

- **File:** `src/sandbox.test.ts`
- **Test:** `WorkerSandbox > should filter environment variables`
- **Error:** `expected '' to contain 'not found'`
- **Cause:** `result.stdout` is empty; test expects stdout to contain a message like “not found” for a filtered secret env var.
- **Fix:** Ensure the worker script prints env check results to stdout and that the test’s command/script is the one actually run.

### 2.5 Acceptance — block filesystem access outside work dir

- **File:** `src/acceptance.test.ts`
- **Test:** `Acceptance Test: Malicious Code Blocking > should block filesystem access outside work directory (worker mode)`
- **Error:** `expected '' to contain 'BLOCKED'`
- **Cause:** Attempt to read e.g. `/etc/passwd` should produce output containing `BLOCKED`; instead stdout is empty.
- **Fix:** Ensure worker mode blocks fs access and that the runner outputs a clear “BLOCKED” (or similar) string to stdout.

### 2.6 Acceptance — block network access

- **File:** `src/acceptance.test.ts`
- **Test:** `should block network access (worker mode)`
- **Error:** `expected '' to match /BLOCKED|timeout/i`
- **Cause:** Network access should be blocked or timeout; stdout is empty.
- **Fix:** Same as 2.5: ensure blocking/timeout is implemented and that stdout contains `BLOCKED` or `timeout`.

### 2.7 Acceptance — enforce timeout limits

- **File:** `src/acceptance.test.ts`
- **Test:** `should enforce timeout limits`
- **Error:** `expected false to be true` (`result.timedOut`)
- **Fix:** Same as 2.3: timeout must be enforced and reflected in `result.timedOut`.

### 2.8 Acceptance — filter environment variables

- **File:** `src/acceptance.test.ts`
- **Test:** `should filter environment variables`
- **Error:** `expected '' to contain 'SECRET_KEY: not found'`
- **Cause:** Worker stdout should show that `SECRET_KEY` is not available (e.g. “SECRET_KEY: not found”).
- **Fix:** Ensure env filter is applied in worker and that the script prints the expected line to stdout.

### 2.9 Acceptance — mask secrets in output

- **File:** `src/acceptance.test.ts`
- **Test:** `should mask secrets in output`
- **Error:** `expected '' to contain '***'`
- **Cause:** `result.maskedStdout` is empty or does not contain `***`.
- **Fix:** Ensure the runner returns masked stdout and that secrets are replaced with `***`.

### 2.10 Acceptance — allow filesystem when allowFilesystem is true

- **File:** `src/acceptance.test.ts`
- **Test:** `should allow filesystem access when allowFilesystem is true`
- **Error:** `expected false to be true` (`result.success`)
- **Cause:** Reading a file inside the work directory with `allowFilesystem: true` should succeed.
- **Fix:** Ensure allowlist is honored and the run returns `success: true` with expected stdout.

---

## 3. @isl-lang/stdlib-auth

**Location:** `packages/stdlib-auth/`

### 3.1 Fastify — authenticate valid token

- **File:** `tests/adapters.test.ts`
- **Test:** `Fastify Adapter > authenticate middleware > should authenticate valid token`
- **Error:** `expected false to be true` (likely `(mockRequest as any).user` or similar)
- **Cause:** After calling the middleware with a valid Bearer token, the request is not marked as authenticated (e.g. `request.user` not set, or middleware calls `reply.code(401)`).
- **Fix:** Ensure the Fastify adapter sets the user on the request when the token is valid and does not call `reply.code(401)` in that case. Ensure mocks match the adapter’s API.

### 3.2 Fastify — reject missing authorization header

- **File:** `tests/adapters.test.ts`
- **Test:** `Fastify Adapter > authenticate middleware > should reject missing authorization header`
- **Error:** `reply.code is not a function`
- **Cause:** Test passes a mock `reply` with `code: vi.fn()...`; the adapter may be calling a different method (e.g. `reply.status(401)`) or the mock is not used correctly.
- **Fix:** Align Fastify adapter with Fastify’s reply API (`reply.code(status)`), or update the mock to match what the adapter calls (e.g. add `status` if the adapter uses it).

### 3.3 Fastify — reject invalid token format

- **File:** `tests/adapters.test.ts`
- **Test:** `Fastify Adapter > authenticate middleware > should reject invalid token format`
- **Error:** `reply.code is not a function`
- **Fix:** Same as 3.2: ensure `mockReply` implements the same method the adapter uses (`code` or `status`).

### 3.4 Express — authenticate valid token

- **File:** `tests/adapters.test.ts`
- **Test:** `Express Adapter > authenticate middleware > should authenticate valid token`
- **Error:** `expected false to be true`
- **Fix:** Same idea as 3.1: ensure Express adapter sets the user on `req` and does not send 401 for a valid token.

### 3.5 Express — reject missing authorization header

- **File:** `tests/adapters.test.ts`
- **Test:** `Express Adapter > authenticate middleware > should reject missing authorization header`
- **Error:** `res.status is not a function`
- **Cause:** Mock `res` does not have `status` or the adapter uses a different API.
- **Fix:** Give the Express mock `res` a `status` function that returns an object with `send`/`json` (e.g. `status: vi.fn().mockReturnThis()`, and `send`/`json` on the same object).

### 3.6 Express — requireRole allow access

- **File:** `tests/adapters.test.ts`
- **Test:** `Express Adapter > requireRole middleware > should allow access for user with required role`
- **Error:** `next is not a function`
- **Cause:** The test passes `next` to the middleware but the mock may be undefined or not a function.
- **Fix:** Ensure `mockNext` is `vi.fn()` (or similar) and is passed correctly to the middleware.

### 3.7 Express — requireRole deny access

- **File:** `tests/adapters.test.ts`
- **Test:** `Express Adapter > requireRole middleware > should deny access for user without required role`
- **Error:** `res.status is not a function`
- **Fix:** Same as 3.5: complete the Express `res` mock with `status` and chained methods.

---

## 4. @isl-lang/isl-core

**Location:** `packages/isl-core/`

### 4.1 ASTCache — LRU eviction

- **File:** `tests/modules.test.ts`
- **Test:** `ASTCache > LRU eviction > should evict least recently used when at capacity`
- **Error:** `expected false to be true` (likely `smallCache.has(id2)` or “id2 was evicted”).
- **Cause:** After inserting three entries with `maxSize: 2` and touching id1, the cache should evict id2 (LRU). The test likely asserts that id2 is not in the cache; the implementation may not be evicting or may be evicting the wrong entry.
- **Fix:** Implement or fix LRU eviction in `ASTCache` (e.g. track access order and evict the least recently used when exceeding `maxSize`).

---

## 5. @isl-lang/isl-discovery

**Location:** `packages/isl-discovery/`

### 5.1 Discover bindings for Fastify routes

- **File:** `src/__tests__/discovery.test.ts`
- **Test:** `Discovery Engine > should discover bindings for Fastify routes`
- **Error:** `expected 0 to be greater than 0` (`result.stats.totalCodeSymbols`)
- **Cause:** Discovery returns no code symbols (or no bindings) for the test fixture.
- **Fix:** Ensure the discovery engine parses the Fastify routes (or the given fixture) and populates `stats.totalCodeSymbols` and `bindings`. Check fixture paths, file parsing, and symbol extraction.

### 5.2 Match by naming conventions

- **File:** `src/__tests__/discovery.test.ts`
- **Test:** `Discovery Engine > should match by naming conventions`
- **Error:** `expected undefined not to be undefined` (binding for `CreateUser`)
- **Cause:** `result.bindings.find(b => b.islSymbol.name === 'CreateUser')` is undefined.
- **Fix:** Ensure naming-based matching produces a binding from the ISL symbol `CreateUser` to the corresponding code symbol (e.g. `createUser`).

### 5.3 Calculate confidence scores

- **File:** `src/__tests__/discovery.test.ts`
- **Test:** `Discovery Engine > should calculate confidence scores correctly`
- **Error:** `expected undefined not to be undefined` (binding for `ExactMatch`)
- **Cause:** No binding found for `ExactMatch`; confidence assertion never runs.
- **Fix:** Same as 5.2: fix discovery/matching so that `ExactMatch` gets a binding and confidence can be asserted.

### 5.4 Handle unbound symbols

- **File:** `src/__tests__/discovery.test.ts`
- **Test:** `Discovery Engine > should handle unbound symbols`
- **Error:** `expected 0 to be greater than 0` (`result.unboundSymbols.length`)
- **Cause:** Unbound symbols (e.g. `NotFound`) are not being reported.
- **Fix:** Ensure the engine collects ISL symbols that have no code binding and exposes them in `result.unboundSymbols`.

---

## 6. @isl-lang/parser (excluded)

**Location:** `packages/parser/`

- **Versioning:** `should detect islVersion directive without hash` — `result.success` false; `should check version compatibility` — `areVersionsCompatible('0.1', '0.1')` false; `should provide migration warnings` — `getMigrationWarnings('0.1', '0.2')` length 0.
- **Peggy parity:** `parses behavior with pre/post conditions` — `peggySuccess` false; `parses imports` — `legacySuccess` false; multiple file-based fixtures show Peggy parse errors (e.g. “Expected \"}\" or optional whitespace but \"e\" found”).
- **Integration:** 15+ ISL files under `examples/`, `packages/`, `samples/` fail to parse (e.g. `ui_blueprint`, `@`, import/entity syntax). Many are due to Peggy grammar not supporting the same syntax as the legacy parser.

Fixing these requires aligning the Peggy grammar and versioning APIs with the legacy behavior and with the ISL files in the repo.

---

## 7. @isl-lang/stdlib-core (excluded)

**Location:** `packages/stdlib-core/`

- **primitives.test.ts:**  
  - `rejects emails exceeding max length` — `isValidEmail(longLocal@...)` expected false, got true.  
  - `isValidCreditCard validates format and checksum` — 15-digit Amex `'411111111111111'` expected true, got false.
- **ids.test.ts:**  
  - `isValidHumanCode accepts valid human codes` — `isValidHumanCode('ABC123')` false.  
  - `isValidObjectId accepts valid MongoDB ObjectIds` — uppercase hex variant false.  
  - `isValidARN accepts valid AWS ARNs` — `isValidARN('arn:aws:s3:::my-bucket')` false.  
  - `generateULID generates valid ULID` — `isValidULID(ulid)` false.  
  - `generateULID is monotonically increasing` — ordering assertion false.
- **time.test.ts:**  
  - `isValidISODate rejects invalid dates` — `isValidISODate('2024-02-30')` expected false, got true.  
  - `accepts valid cron expressions` — `isValidCronExpression('*/15 * * * *')` false.

Fix by either updating validators to match the specified behavior or updating tests to match current (documented) behavior.

---

## Summary counts

| Package                     | Failing tests |
|----------------------------|---------------|
| phantom-dependency-scanner | 2             |
| verifier-sandbox           | 10            |
| stdlib-auth                | 7             |
| isl-core                   | 1             |
| isl-discovery              | 4             |
| parser                     | 20+ (versioning, parity, integration) |
| stdlib-core                | 9             |

**Total:** 53+ distinct failing tests across 7 packages.

After fixing these, remove the corresponding package names from the `if (command === 'test')` block in `scripts/run-production.ts` so they are included in `pnpm test:production` again.
