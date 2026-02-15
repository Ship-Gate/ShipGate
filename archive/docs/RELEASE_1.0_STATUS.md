# Release 1.0 Status - February 9, 2026

## ✅ Fixed Issues

1. **@isl-lang/core duplicate exports** - Fixed conflicts:
   - `DEFAULT_WEIGHTS` (isl-agent/scoring vs spec-quality) → exported with aliases
   - `PolicySeverity` and `PolicyViolation` (policies vs team-config) → exported with aliases

2. **@isl-lang/core md-to-pdf types** - Added stub type declarations for optional dependency

3. **CLI verify.ts Domain/DomainDeclaration** - Changed to use `Domain` from parser instead of `DomainDeclaration`

4. **@isl-lang/build-runner** - Fixed tsup config to generate .d.ts files

5. **@isl-lang/isl-proof migrate.ts** - Fixed v1Bundle initialization issues

## ⚠️ Remaining Type Errors

### Critical (Blocks CLI)
- `@isl-lang/proof` - Missing .d.ts files (verification-engine.ts has evaluator import errors)
- `@isl-lang/semantic-analysis` - Missing .d.ts files  
- `@isl-lang/import-resolver` - Has .d.ts files but CLI still reports missing
- `@isl-lang/verifier-chaos` - Missing .d.ts files
- CLI commands (chaos.ts, check.ts, fmt.ts) - Various type mismatches

### Non-Critical (Internal packages)
- `@isl-lang/dashboard-web` - Build fails (private package, can skip)

## Next Steps to 1.0

### Phase 1: Fix Remaining Type Errors (2-4 hours)
1. Fix `@isl-lang/proof` verification-engine.ts evaluator imports
2. Ensure all packages generate .d.ts files
3. Fix CLI command type mismatches
4. Run full typecheck and verify passes

### Phase 2: Fix Tests (2-4 hours)
1. Run `pnpm test` and identify failures
2. Fix test failures (especially playground blocker)
3. Verify >90% pass rate

### Phase 3: Prepare for Publishing (1-2 hours)
1. Update production package.json files:
   - Remove `private: true`
   - Set version to `1.0.0`
   - Ensure proper `files`, `exports`, `types` fields
2. Create/update CHANGELOG.md
3. Update README with published package info

### Phase 4: Publish (1 hour)
1. Publish core packages first:
   - @isl-lang/parser
   - @isl-lang/typechecker
   - @isl-lang/evaluator
   - @isl-lang/isl-core
2. Publish CLI as `shipgate`
3. Publish verification packages
4. Publish codegen packages
5. Publish stdlib packages

### Phase 5: Verify (30 min)
1. Test `npx shipgate --version`
2. Test `npx shipgate init`
3. Verify packages are installable

## Estimated Total Time: 6-12 hours

## Current Status: ~40% Complete

- ✅ Type errors: ~60% fixed
- ⏳ Tests: Not yet run
- ⏳ Publishing prep: Not started
- ⏳ Publishing: Not started
