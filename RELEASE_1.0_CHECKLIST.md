# Shipgate 1.0 Release Checklist

**Target Date:** TBD  
**Status:** 🟡 In Progress  
**Last Updated:** 2026-02-09

---

## Pre-Release Fixes

### Critical (Must Fix)
- [x] **Update README.md** - Change status from "Pre-release (v0.1.0)" to "v1.0.0" ✅
- [x] **Fix `@isl-lang/stdlib-idempotency` tsconfig** - Removed `rootDir` restriction ✅
- [ ] **Verify CLI works** - Test `npx shipgate --version` and `npx shipgate init`

### Optional (Nice to Have)
- [x] **Fix `@isl-lang/stdlib-distributed` build** - Added .js extensions to imports ✅
- [ ] **Update root package.json version** - Change from `0.1.0` to `1.0.0` if desired
- [ ] **Fix before green build:** @isl-lang/truthpack-v2 (type errors, missing module @isl-lang/proof/claim-integration, type/value confusions) – CLI depends on it.
- [ ] **Un-quarantine and fix** (post-1.0): @isl-lang/isl-healer, @isl-lang/claims-verifier, @isl-lang/test-generator, @isl-lang/mock-detector, @isl-lang/solver-z3-wasm, @isl-lang/stdlib-idempotency

---

## Build & Test Verification

### Production Build
- [ ] Run `pnpm build:production` - **Current: 72/79 tasks** (blocker: `@isl-lang/truthpack-v2` – many type errors; CLI depends on it). Quarantine: codegen-tests, isl-verify-pipeline, isl-healer, claims-verifier, test-generator, mock-detector, solver-z3-wasm, stdlib-observability, stdlib-ai, stdlib-idempotency.
- [ ] Verify core packages build:
  - [ ] `@isl-lang/parser`
  - [ ] `@isl-lang/typechecker`
  - [ ] `@isl-lang/evaluator`
  - [ ] `@isl-lang/cli` (shipgate)
  - [ ] `@isl-lang/isl-core`
  - [ ] `@isl-lang/verifier-runtime`

### Type Checking
- [ ] Run `pnpm typecheck:production` - Fix any blocking errors
- [ ] Verify no critical type errors in production packages
- [ ] Check that `.d.ts` files are generated for all published packages

### Tests
- [ ] Run `pnpm test:production` - Verify >90% pass rate
- [ ] Run `pnpm test:critical` - Core packages must pass
- [ ] Verify CLI smoke tests pass: `pnpm --filter shipgate test:smoke`

---

## Package Readiness

### Production Packages Status
- [ ] Verify 32/42 production packages meet 75% readiness threshold ✅
- [ ] Check packages below threshold (10 packages) - Decide if acceptable for 1.0:
  - [ ] `@isl-lang/codegen` (63%)
  - [ ] `@isl-lang/codegen-openapi` (63%)
  - [ ] `@isl-lang/codegen-tests` (63%)
  - [ ] `@isl-lang/isl-verify` (63%)
  - [ ] `@isl-lang/language-server` (63%)
  - [ ] `@isl-lang/semantics` (63%)
  - [ ] `@isl-lang/stdlib-auth` (63%)
  - [ ] `@isl-lang/codegen-graphql` (50%)
  - [ ] `@isl-lang/codegen-python` (50%)
  - [ ] `@isl-lang/codegen-runtime` (50%)

### Package Publishing Status
- [x] **CLI published** - `shipgate` v1.0.0 ✅
- [ ] Verify other core packages are published (if needed):
  - [ ] `@isl-lang/parser`
  - [ ] `@isl-lang/typechecker`
  - [ ] `@isl-lang/evaluator`
  - [ ] `@isl-lang/isl-core`

---

## Documentation

### README Updates
- [ ] Update version number in README.md
- [ ] Update status badge/description
- [ ] Verify installation instructions work
- [ ] Check all links are valid

### Release Notes
- [ ] Review `docs/RELEASE_NOTES_1_0.md` - Ensure accurate
- [ ] Update with actual changes since last version
- [ ] Include breaking changes (if any)
- [ ] List new features

### Documentation Site
- [ ] Verify homepage: https://shipgate.dev
- [ ] Check quickstart guide is accessible
- [ ] Verify API documentation is up to date

---

## CI/CD & Automation

### GitHub Actions
- [ ] Verify `.github/workflows/release-shipgate.yml` is configured correctly
- [ ] Test release workflow (dry-run if possible)
- [ ] Verify CI badges work in README

### Release Process
- [ ] Create release tag: `v1.0.0` or `shipgate@1.0.0`
- [ ] Generate release manifest: `pnpm release:manifest`
- [ ] Verify license compliance: `pnpm compliance:all`

---

## Post-Release Verification

### Installation Test
- [ ] Test fresh install: `npm install -g shipgate`
- [ ] Verify `shipgate --version` shows `1.0.0`
- [ ] Test `npx shipgate init` works
- [ ] Verify CLI commands function correctly

### Integration Tests
- [ ] Test GitHub Action integration (if applicable)
- [ ] Verify VS Code extension compatibility (if published)
- [ ] Test MCP server integration (if applicable)

### Monitoring
- [ ] Monitor npm download stats
- [ ] Check for immediate issues/bugs
- [ ] Monitor GitHub issues for user feedback

---

## Communication

### Announcements
- [ ] Draft release announcement
- [ ] Post to relevant channels (Twitter/X, HN, Reddit, etc.)
- [ ] Update project status pages
- [ ] Notify early adopters/users

### Support
- [ ] Ensure support channels are ready
- [ ] Update FAQ/docs with common questions
- [ ] Prepare migration guide (if needed)

---

## Rollback Plan

- [ ] Document rollback procedure
- [ ] Identify critical issues that would require rollback
- [ ] Prepare hotfix process if needed

---

## Final Sign-Off

- [ ] All critical items completed
- [ ] All tests passing
- [ ] Documentation updated
- [ ] Release approved by team
- [ ] **Ready to publish** ✅

---

## Notes

- CLI is already published at v1.0.0 ✅
- Most production packages are ready (76% meet threshold)
- Minor issues remain but don't block release
- Focus on fixing critical items before final release

---

**Checklist created:** 2026-02-09  
**Next review:** Before release
