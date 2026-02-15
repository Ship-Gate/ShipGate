# IntentOS Improvement Execution Checklist

This document maps improvement items to specific packages, commands, and acceptance criteria.

---

## Priority 1: CRITICAL (Blocks Core Functionality)

### 1.1 Expression Evaluator

| Field | Value |
|-------|-------|
| **Status** | 🟡 Partial |
| **Owner** | `packages/verifier-runtime/` |
| **Blockers** | Complex expressions return `'unknown'` instead of actual values |

**Package Map:**
- `packages/verifier-runtime/src/evaluator.ts` - Core tri-state evaluator (1188 lines)
- `packages/verifier-runtime/src/types.ts` - `EvaluationContext` interface
- `packages/isl-expression-evaluator/` - Standalone evaluator module

**Commands:**
```bash
pnpm --filter @isl-lang/verifier-runtime test
pnpm --filter @isl-lang/verifier-runtime build
```

**Acceptance Criteria:**
- [ ] `User.exists(result.id)` returns `true`/`false` (not `'unknown'`)
- [ ] `email.is_valid` evaluates against actual email validation
- [ ] `result.status == 'success'` compares actual values
- [ ] `old(User.count()) < User.count()` works with state snapshots
- [ ] All quantifiers (`all`, `any`) iterate and evaluate predicates
- [ ] Expression adapter interface allows domain-specific implementations

**Evidence:**
```typescript
// packages/verifier-runtime/tests/evaluator.test.ts must pass:
it('evaluates User.exists() with database lookup', async () => {
  const result = evaluateExpression(expr, context);
  expect(result.value).toBe(true); // NOT 'unknown'
});
```

---

### 1.2 Import Resolution

| Field | Value |
|-------|-------|
| **Status** | 🟢 Implemented |
| **Owner** | `packages/import-resolver/` |
| **Blockers** | Stdlib registry needs more modules |

**Package Map:**
- `packages/import-resolver/src/index.ts` - Main entry (317 lines)
- `packages/import-resolver/src/resolver.ts` - Import resolution logic
- `packages/import-resolver/src/bundler.ts` - Multi-file bundling
- `packages/import-resolver/src/stdlib-registry.ts` - Stdlib module registry (320 lines)

**Commands:**
```bash
pnpm --filter @isl-lang/import-resolver test
pnpm --filter @isl-lang/import-resolver build
```

**Acceptance Criteria:**
- [x] `use stdlib-auth` resolves to `@isl/auth` module
- [x] Circular dependency detection with clear error messages
- [x] Module not found errors include suggestions
- [x] Virtual file system support for testing
- [x] `parseSingleFile()` rejects imports with explicit error
- [ ] All stdlib modules registered in `stdlib-registry.json`

**API Reference:**
```typescript
// Resolve and bundle multiple files
const result = await resolveAndBundle('./main.isl', {
  enableImports: true,
  basePath: './specs',
});

// Single-file mode (imports disabled)
const result = parseSingleFile(source, 'spec.isl');
```

---

### 1.3 Semantic Analysis (Type Checking)

| Field | Value |
|-------|-------|
| **Status** | 🟡 Partial |
| **Owner** | `packages/isl-semantic-analysis/` |
| **Blockers** | Limited passes implemented |

**Package Map:**
- `packages/isl-semantic-analysis/src/framework.ts` - Plugin architecture (152 lines)
- `packages/isl-semantic-analysis/src/passes/` - Analysis passes
- `packages/typechecker/` - Full type checking (future)

**Commands:**
```bash
pnpm --filter @isl-lang/semantic-analysis test
pnpm --filter @isl-lang/semantic-analysis build
```

**Acceptance Criteria:**
- [x] Symbol resolution pass (`symbolResolverPass`)
- [x] Symbol table with scoping (`SymbolTable`)
- [ ] Undefined type detection (`status: NonExistentType` → error)
- [ ] Unused entity/behavior warnings
- [ ] Unreachable clause detection
- [ ] Refinement type sanity checks

**Diagnostic Codes:**
| Code | Description |
|------|-------------|
| `E0500` | Semantic pass failure |
| `E0501` | Undefined symbol reference |
| `E0502` | Duplicate symbol definition |
| `W0501` | Unused import |
| `W0502` | Shadowed definition |

---

## Priority 2: HIGH (Major UX Issues)

### 2.1 Executable Test Generation

| Field | Value |
|-------|-------|
| **Status** | 🟡 Partial |
| **Owner** | `packages/codegen-tests/` |
| **Blockers** | Precondition test values not generated |

**Package Map:**
- `packages/codegen-tests/src/` - Test code generation
- `packages/codegen-types/src/` - Type generation (works)
- `packages/isl-test-runtime/` - Runtime test harness

**Commands:**
```bash
pnpm --filter @isl-lang/codegen-tests test
isl codegen --tests spec.isl -o tests/
```

**Acceptance Criteria:**
- [x] Test stubs generated for each behavior
- [x] Precondition comments include original expression
- [ ] Invalid input values auto-generated for precondition tests
- [ ] Success path test with valid mock data
- [ ] Postcondition assertions use evaluator

**Example Output:**
```typescript
// CURRENT (partial)
it('validates precondition: email.is_valid', async () => {
  // TODO: Implement test
});

// EXPECTED (complete)
it('validates precondition: email.is_valid', async () => {
  const invalidInput = { email: 'not-an-email', password: 'valid123' };
  const result = await login(invalidInput);
  expect(result.success).toBe(false);
  expect(result.error?.code).toBe('VALIDATION_FAILED');
});
```

---

### 2.2 Watch Mode

| Field | Value |
|-------|-------|
| **Status** | 🟢 Implemented |
| **Owner** | `packages/cli/` |
| **Blockers** | None |

**Package Map:**
- `packages/cli/src/commands/watch.ts` - Watch command
- `packages/cli/src/cli.ts` - CLI entry point

**Commands:**
```bash
isl build spec.isl --watch
isl gate ./src --watch
```

**Acceptance Criteria:**
- [x] File watcher triggers rebuild on `.isl` changes
- [x] Debouncing prevents rapid rebuilds
- [x] Clear console on rebuild (optional)
- [x] Exit on ctrl+c
- [x] Error recovery without crash

---

### 2.3 Better Error Messages

| Field | Value |
|-------|-------|
| **Status** | 🟡 Partial |
| **Owner** | `packages/errors/` |
| **Blockers** | Parser errors lack suggestions |

**Package Map:**
- `packages/errors/src/catalog.ts` - Error code catalog
- `packages/errors/src/formatter.ts` - Error formatting
- `packages/isl-core/src/parser/parser.ts` - Parser error generation

**Commands:**
```bash
pnpm --filter @isl-lang/errors test
```

**Acceptance Criteria:**
- [x] Line and column numbers in all errors
- [x] Source code snippet with caret
- [ ] "Did you mean?" suggestions for typos
- [ ] Documentation links for common errors
- [ ] Multi-line error context

---

## Priority 3: MEDIUM (Polish)

### 3.1 Proof Bundle System

| Field | Value |
|-------|-------|
| **Status** | 🟢 Implemented |
| **Owner** | `packages/isl-proof/` |
| **Blockers** | None |

**Package Map:**
- `packages/isl-proof/src/manifest.ts` - V2 manifest schema (514 lines)
- `packages/isl-proof/src/verifier.ts` - Bundle verification (407 lines)
- `packages/isl-proof/src/writer.ts` - Bundle writer
- `packages/isl-proof/src/verification-engine.ts` - Clause verification

**Commands:**
```bash
islstudio proof create --spec spec.isl --output proof/
islstudio proof verify proof/
```

**Acceptance Criteria:**
- [x] PROVEN/INCOMPLETE_PROOF/VIOLATED tri-state verdicts
- [x] Bundle ID integrity verification
- [x] Signature support (HMAC-SHA256)
- [x] Iteration history tracking
- [x] Spec hash verification

---

### 3.2 Policy Packs

| Field | Value |
|-------|-------|
| **Status** | 🟢 Implemented |
| **Owner** | `packages/isl-policy-packs/` |
| **Blockers** | None |

**Package Map:**
- `packages/isl-policy-packs/src/registry.ts` - Pack registry
- `packages/isl-policy-packs/src/packs/pii.ts` - PII rules
- `packages/isl-policy-packs/src/packs/quality.ts` - Quality rules
- `packages/isl-pipeline/src/semantic-rules.ts` - Core semantic rules (1467 lines)

**Semantic Rules:**
| Rule ID | Description | Severity |
|---------|-------------|----------|
| `intent/audit-required` | Audit on ALL exit paths | critical |
| `intent/rate-limit-required` | Rate limit before body parse | high |
| `intent/no-pii-logging` | No PII in logs | critical |
| `intent/input-validation` | Schema validation before use | high |
| `intent/encryption-required` | Encrypt sensitive data | critical |
| `quality/no-stubbed-handlers` | No TODO/stub in handlers | critical |
| `quality/validation-before-use` | Validate before business logic | high |

---

### 3.3 Healer (Auto-Fix)

| Field | Value |
|-------|-------|
| **Status** | 🟢 Implemented |
| **Owner** | `packages/isl-healer/` |
| **Blockers** | Limited fix recipes |

**Package Map:**
- `packages/isl-healer/src/` - Healer implementation
- `packages/cli/src/commands/heal.ts` - Heal CLI command (422 lines)
- `packages/isl-pipeline/src/fix-recipes.ts` - Fix recipes

**Commands:**
```bash
isl heal ./src --max-iterations 5
isl heal ./src --dry-run
```

---

## Verification Commands

### Full Pipeline Test
```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Run specific package tests
pnpm --filter @isl-lang/verifier-runtime test
pnpm --filter @isl-lang/import-resolver test
pnpm --filter @isl-lang/semantic-analysis test

# Integration test
pnpm --filter @isl-lang/cli test
```

### Gate Check
```bash
islstudio gate ./src --policy intent-pack
```

### Proof Bundle
```bash
islstudio proof create --spec spec.isl
islstudio proof verify ./proof-bundle
```

---

## Package Dependency Graph

```
┌─────────────────┐
│   @isl-lang/cli │ ─── Commands: build, gate, heal, proof
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌──────────────┐
│ parser │ │ isl-pipeline │ ─── Gate checks, semantic rules
└────┬───┘ └──────┬───────┘
     │            │
     ▼            ▼
┌────────────┐ ┌──────────────────┐
│ isl-core   │ │ verifier-runtime │ ─── Expression evaluation
└────────────┘ └──────────────────┘
     │
     ▼
┌─────────────────┐
│ import-resolver │ ─── Module bundling, stdlib
└─────────────────┘
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Expression eval coverage | ~60% | 95% |
| Stdlib modules registered | 3 | 10 |
| Semantic passes | 2 | 8 |
| Test generation completeness | ~40% | 80% |
| Error message quality | Basic | Rich with suggestions |
