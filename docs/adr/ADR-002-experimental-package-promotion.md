# ADR-002: Experimental Package Promotion Plan

**Status:** Proposed  
**Date:** 2026-02-03  
**Authors:** ISL Team  
**Related:** ADR-001-ast-type-unification.md  

---

## Context

The ISL monorepo contains many experimental/quarantined packages that are excluded from production builds. This document categorizes these packages by blocker type and provides a promotion plan.

---

## Package Categorization

### Category A: Blocked by AST Unification

These packages have local AST type definitions that duplicate `@isl-lang/parser` types. They cannot be promoted until ADR-001 migration is complete.

| Package | Blocker | Promotion Path |
|---------|---------|----------------|
| **@isl-lang/isl-federation** | Full AST copy in `src/ast.ts` | Delete local types, import from parser |
| **@isl-lang/versioner** | Full AST copy in `src/ast-types.ts` | Delete local types, import from parser |
| **@isl-lang/codegen-go** | Full AST copy in `src/ast-types.ts` | Delete local types, import from parser |
| **@isl-lang/codegen-rust** | Full AST copy in `src/ast-types.ts` | Delete local types, import from parser |
| **@isl-lang/codegen-loadtest** | Full AST copy in `src/ast-types.ts` | Delete local types, import from parser |
| **@isl-lang/security-policies** | Partial AST copy in `src/types.ts` | Remove duplicate types, import from parser |
| **@isl-lang/codegen-openapi** | Local Domain interface | Use simplified types from parser utilities |
| **@isl-lang/codegen-graphql** | Multiple local Domain interfaces | Consolidate to parser import |
| **@isl-lang/spec-federation** | Local DomainAST type | Replace with parser Domain |

### Category B: Dependency/Config Issues

These packages have missing dependencies, incorrect configs, or build issues unrelated to AST types.

| Package | Blocker | Promotion Path |
|---------|---------|----------------|
| **@isl-lang/codegen-wasm** | Requires binaryen/wabt native deps | Add optional deps, document requirements |
| **@isl-lang/formal-verification** | Requires Z3/CVC5 SMT solvers | Add optional deps, conditional build |
| **@isl-lang/codegen-terraform** | Partial implementation | Complete provider templates |
| **@isl-lang/effect-handlers** | Known build issues | Fix TypeScript configuration |
| **@isl-lang/effect-system** | Depends on effect-handlers | Wait for effect-handlers fix |
| **@isl-lang/effects** | Depends on effect-handlers | Wait for effect-handlers fix |
| **@isl-lang/mutation-testing** | Incomplete implementation | Complete mutation operators |
| **@isl-lang/fuzzer** | Incomplete implementation | Complete fuzzing strategies |
| **@isl-lang/db-generator** | Missing Prisma/Drizzle adapters | Add ORM templates |
| **@isl-lang/api-generator** | Missing route handlers | Add framework templates |

### Category C: Shell/Stub Packages

These packages have minimal or placeholder implementations. They're quarantined because they provide no value yet.

| Package | Description | Promotion Criteria |
|---------|-------------|-------------------|
| **@isl-lang/sdk-typescript** | TS SDK generator shell | Need real generation |
| **@isl-lang/sdk-web** | Web SDK generator shell | Need real generation |
| **@isl-lang/sdk-react-native** | RN SDK generator shell | Need real generation |
| **@isl-lang/sdk-flutter** | Flutter SDK generator | Need Dart codegen |
| **@isl-lang/sdk-kotlin** | Kotlin SDK generator | Need Kotlin codegen |
| **@isl-lang/sdk-swift** | Swift SDK generator | Need Swift codegen |
| **@isl-lang/sdk-python** | Python SDK generator | Need Python codegen |
| **@isl-lang/stdlib-ml** | ML types only | Need runtime impl |
| **@isl-lang/stdlib-time** | Time types only | Need runtime impl |
| **@isl-lang/agent-os** | Agent orchestration | Future roadmap |
| **@isl-lang/ai-copilot** | AI integration | Experimental |
| **@isl-lang/ai-generator** | AI spec generation | Experimental |
| **@isl-lang/isl-ai** | ISL AI features | Experimental |

### Category D: Platform/Infrastructure (Not Needed for 1.0)

These packages are for platform services not required for the 1.0 release.

| Package | Description | Promotion Criteria |
|---------|-------------|-------------------|
| **@isl-lang/marketplace-api** | Package marketplace | Post-1.0 |
| **@isl-lang/marketplace-web** | Marketplace UI | Post-1.0 |
| **@isl-lang/dashboard-api** | Verification dashboard | Post-1.0 |
| **@isl-lang/dashboard-web** | Dashboard UI | Post-1.0 |
| **@isl-lang/github-app** | GitHub App integration | Post-1.0 |
| **@isl-lang/slack-bot** | Slack integration | Post-1.0 |
| **@isl-lang/registry-client** | Package registry | Post-1.0 |

### Category E: Internal/Tools (Already Private)

These packages are internal tools already marked private and not published.

| Package | Description | Notes |
|---------|-------------|-------|
| **@isl-lang/visual-editor** | Visual ISL editor | Internal tool |
| **@isl-lang/trace-viewer** | Trace visualization | Internal tool |
| **@isl-lang/playground** | Online playground | Web app |
| **@isl-lang/docs** | Documentation site | Web app |
| **@isl-lang/docs-advanced** | Advanced docs | Web app |

---

## Promotion Readiness Criteria

For a package to be promoted from experimental to production, it must meet ALL of the following:

### 1. Build Criteria
- [ ] `pnpm build` succeeds without errors
- [ ] No circular dependencies
- [ ] Exports are correctly configured in `package.json`
- [ ] All imports use canonical AST types

### 2. Test Criteria
- [ ] `pnpm test` runs and passes
- [ ] Test coverage ≥ 60% for core functionality
- [ ] No skipped tests without documented reason
- [ ] Integration tests for main use cases

### 3. Type Criteria
- [ ] `pnpm typecheck` passes
- [ ] No `any` types in public API
- [ ] All exports have proper type annotations
- [ ] Follows ADR-001 canonical type imports

### 4. Documentation Criteria
- [ ] README.md with usage examples
- [ ] JSDoc on exported functions/types
- [ ] API surface documented
- [ ] Changelog entry for features

### 5. Lint Criteria
- [ ] `pnpm lint` passes
- [ ] No console.log in production code
- [ ] No hardcoded secrets
- [ ] Follows workspace ESLint rules

---

## Ordered Promotion Plan

### Phase 1: AST Unification (Prerequisites)

Complete ADR-001 migration before promoting any Category A packages.

**Tasks:**
1. Run codemod: `pnpm tsx scripts/codemod-ast-imports.ts`
2. Delete duplicate type files (see ADR-001)
3. Update barrel exports
4. Verify `pnpm -r build` and `pnpm -r test`

**Estimated impact:** ~10 packages unblocked

### Phase 2: Quick Wins (Low Effort, High Value)

Packages that are mostly complete and just need cleanup.

| Priority | Package | Effort | Value | Tasks |
|----------|---------|--------|-------|-------|
| 1 | @isl-lang/isl-federation | Low | High | Delete ast.ts, update imports |
| 2 | @isl-lang/versioner | Low | High | Delete ast-types.ts, update imports |
| 3 | @isl-lang/security-policies | Low | Medium | Remove duplicate types |
| 4 | @isl-lang/spec-federation | Low | Medium | Update DomainAST references |
| 5 | @isl-lang/codegen-graphql | Medium | High | Consolidate Domain types |

### Phase 3: Codegen Packages (Language Support)

Important for cross-language support.

| Priority | Package | Effort | Value | Tasks |
|----------|---------|--------|-------|-------|
| 1 | @isl-lang/codegen-go | Medium | High | Delete ast-types.ts, complete templates |
| 2 | @isl-lang/codegen-rust | Medium | High | Delete ast-types.ts, complete templates |
| 3 | @isl-lang/codegen-loadtest | Low | Medium | Delete ast-types.ts |
| 4 | @isl-lang/codegen-kubernetes | Medium | Medium | Complete manifests |
| 5 | @isl-lang/codegen-terraform | High | Medium | Add cloud providers |

### Phase 4: Advanced Features (Higher Effort)

Complex packages requiring more work.

| Priority | Package | Effort | Value | Tasks |
|----------|---------|--------|-------|-------|
| 1 | @isl-lang/effect-handlers | High | Medium | Fix TS issues |
| 2 | @isl-lang/formal-verification | High | High | Add optional Z3 deps |
| 3 | @isl-lang/mutation-testing | High | Medium | Complete operators |
| 4 | @isl-lang/fuzzer | High | Medium | Complete strategies |
| 5 | @isl-lang/codegen-wasm | High | Low | Add native deps |

### Phase 5: SDK Generators (Post-1.0)

SDK generators are lower priority for 1.0.

| Priority | Package | Effort | Value | Tasks |
|----------|---------|--------|-------|-------|
| 1 | @isl-lang/sdk-typescript | High | Medium | Full implementation |
| 2 | @isl-lang/sdk-python | High | Medium | Full implementation |
| 3 | @isl-lang/sdk-web | High | Low | Full implementation |
| 4 | @isl-lang/sdk-kotlin | High | Low | Kotlin codegen |
| 5 | @isl-lang/sdk-swift | High | Low | Swift codegen |

---

## Migration Commands

### Check Package Status

```bash
# Check if a package builds
pnpm --filter @isl-lang/[package-name] build

# Check if a package tests pass
pnpm --filter @isl-lang/[package-name] test

# Check for AST import violations
pnpm tsx scripts/check-ast-imports.ts | grep [package-name]
```

### Promote a Package

```bash
# 1. Remove from experimental list in experimental.json
# 2. Update package.json: remove "private": true
# 3. Ensure all criteria pass:
pnpm --filter @isl-lang/[package-name] build
pnpm --filter @isl-lang/[package-name] test
pnpm --filter @isl-lang/[package-name] typecheck
pnpm --filter @isl-lang/[package-name] lint
```

### Batch Promotion (After AST Unification)

```bash
# Run codemod
pnpm tsx scripts/codemod-ast-imports.ts

# Verify all builds
pnpm -r build

# Verify all tests
pnpm -r test

# Check for remaining violations
pnpm tsx scripts/check-ast-imports.ts
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Experimental packages | ~100 | <30 |
| Category A (AST blocked) | ~10 | 0 |
| Category B (Deps issues) | ~10 | <5 |
| Category C (Shells) | ~30 | Keep as needed |
| Category D (Platform) | ~10 | Keep for post-1.0 |

---

## Appendix: Package-by-Package Details

### @isl-lang/isl-federation

**Current Status:** Experimental  
**Blocker:** Full AST copy (594 lines)  
**File to Delete:** `src/ast.ts`  

**Promotion Steps:**
1. Delete `src/ast.ts`
2. Update imports in all files: `import type { Domain, ... } from '@isl-lang/parser'`
3. Update `src/index.ts` exports
4. Run tests
5. Remove from experimental list

---

### @isl-lang/versioner

**Current Status:** Experimental  
**Blocker:** Full AST copy (469 lines)  
**File to Delete:** `src/ast-types.ts`  

**Promotion Steps:**
1. Delete `src/ast-types.ts`
2. Update imports
3. Run tests
4. Remove from experimental list

---

### @isl-lang/codegen-go

**Current Status:** Experimental (partial)  
**Blocker:** Full AST copy (537 lines) + incomplete templates  
**File to Delete:** `src/ast-types.ts`  

**Promotion Steps:**
1. Delete `src/ast-types.ts`
2. Update imports
3. Complete Go struct templates
4. Add integration tests
5. Move to partial category, then production

---

### @isl-lang/effect-handlers

**Current Status:** Experimental  
**Blocker:** TypeScript configuration issues  
**Notes:** "Has known issues - build/test scripts skip with warning message"  

**Promotion Steps:**
1. Fix tsconfig.json
2. Resolve module resolution issues
3. Add proper exports
4. Run full test suite
5. Document effect system usage

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-02-03 | ISL Team | Initial categorization |
