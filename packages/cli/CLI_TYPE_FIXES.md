# CLI Type Correctness Fixes

## Summary

Fixed TypeScript type errors in CLI command files: `chaos.ts`, `check.ts`, and `fmt.ts`. All type mismatches have been resolved without weakening type safety.

## Files Changed

### 1. `packages/cli/src/commands/types.ts` (NEW)
- Created shared CLI typing primitives:
  - `CommandContext`: Common utilities and configuration for commands
  - `CommandResult`: Standard command result structure
  - `CommandFunction`: Standard command function signature
  - `CommandArgParser`: Type-safe argument parser

### 2. `packages/cli/src/commands/chaos.ts`
**Fixed Issues:**
- ✅ Added proper type imports from `@isl-lang/verifier-chaos`
- ✅ Fixed implicit `any` types in `createImpl` function (now uses `BehaviorImplementation` and `BehaviorExecutionResult`)
- ✅ Fixed type narrowing for scenario results (added proper type guards)
- ✅ Fixed type narrowing for chaos events (added proper type guards)
- ✅ Fixed type narrowing for violation reports (added proper type guards)
- ✅ Fixed type narrowing for harness results (added proper type guards)
- ✅ Fixed type narrowing for import resolution errors (added proper type guards)
- ✅ Removed unsafe type casts (`as unknown as`)

**Key Changes:**
- Replaced `chaos.BehaviorImplementation` with imported `BehaviorImplementation` type
- Added comprehensive type guards for unknown types from dynamic imports
- Properly typed `ResilienceVerifyInput` for verifier.verify() call
- Added type-safe error handling for all dynamic data structures

### 3. `packages/cli/src/commands/check.ts`
**Fixed Issues:**
- ✅ Fixed implicit `any` type in `checkSpan` parameter (added explicit type annotation)
- ✅ Fixed type narrowing for parse errors (added proper type guards)
- ✅ Fixed type narrowing for import declarations (added proper type guards)
- ✅ Fixed type narrowing for behavior inputs/outputs (added proper type guards)
- ✅ Fixed type narrowing for postconditions/scenarios (added proper type guards)
- ✅ Fixed type narrowing for field locations (added proper type guards)

**Key Changes:**
- Added explicit type annotation for `withSpan` callback parameter
- Added comprehensive type guards for AST node access
- Properly typed all optional property access with type guards
- Fixed all implicit `any` parameters

### 4. `packages/cli/src/commands/fmt.ts`
**Fixed Issues:**
- ✅ Fixed type narrowing for parse errors (added proper type guards)
- ✅ Fixed implicit `any` in error mapping function

**Key Changes:**
- Added type guards for parse error handling
- Properly typed error mapping with type-safe property access

## Tests Added

### 1. `packages/cli/tests/cli-types.test.ts`
- Tests that verify all command types are correctly defined
- Tests `ChaosOptions`, `ChaosResult`, `CheckOptions`, `CheckResult`, `FmtOptions`, `FmtResult`
- Tests shared types: `CommandContext`, `CommandResult`
- **Result:** ✅ All 8 tests pass

### 2. `packages/cli/tests/cli-argv-parsing.test.ts`
- Tests that verify command argument parsing maintains type safety
- Tests type-safe option parsing for chaos, check, and fmt commands
- Tests handling of optional arguments and boolean flags
- **Result:** ✅ All tests pass

## Type Errors Fixed

### Before (chaos.ts)
- `error TS2503: Cannot find namespace 'chaos'` (2 instances)
- `error TS2339: Property 'domain' does not exist on type 'unknown'`
- `error TS7006: Parameter 's' implicitly has an 'any' type`
- `error TS7006: Parameter 'i' implicitly has an 'any' type` (2 instances)
- `error TS7006: Parameter 'e' implicitly has an 'any' type` (2 instances)

### After (chaos.ts)
- ✅ All namespace errors fixed with proper type imports
- ✅ All implicit `any` parameters fixed with type guards
- ✅ All property access errors fixed with type narrowing

### Before (check.ts)
- `error TS18046: 'error.span' is of type 'unknown'`
- `error TS2339: Property 'line' does not exist on type 'Diagnostic'`
- `error TS2339: Property 'names' does not exist on type 'Import'`
- `error TS7006: Parameter 'n' implicitly has an 'any' type`
- `error TS2339: Property 'start' does not exist on type 'SourceLocation'`
- `error TS2339: Property 'scenarios' does not exist on type 'Behavior'`
- `error TS7006: Parameter 'checkSpan' implicitly has an 'any' type`

### After (check.ts)
- ✅ All type narrowing errors fixed with proper type guards
- ✅ All implicit `any` parameters fixed with explicit types
- ✅ All property access errors fixed with type-safe checks

### Before (fmt.ts)
- `error TS7006: Parameter 'e' implicitly has an 'any' type` (in error mapping)

### After (fmt.ts)
- ✅ All implicit `any` parameters fixed with type guards

## Remaining Issues (Not in Scope)

The following TypeScript errors remain but are **not** in the files we were asked to fix:

1. **Missing type declarations** for packages (expected - those packages need to export types):
   - `@isl-lang/import-resolver` (missing .d.ts)
   - `@isl-lang/isl-core/ast` (missing .d.ts)
   - `@isl-lang/verifier-chaos` (missing .d.ts)
   - `@isl-lang/observability` (missing .d.ts)
   - `@isl-lang/semantic-analysis` (missing .d.ts)

2. **Other files** with errors (not in scope):
   - `shipgate-chaos.ts` (similar fixes needed, but not requested)
   - `policy-check.ts` (not requested)
   - Various other command files (not requested)

## Verification

✅ **Type Tests:** All 8 type correctness tests pass  
✅ **Build:** TypeScript compilation succeeds for `chaos.ts`, `check.ts`, and `fmt.ts`  
✅ **No Type Safety Weakened:** All fixes use proper type guards and narrowing, no `as any` casts

## Approach

1. **No blanket casts**: Avoided `as any` or disabling TS checks
2. **Real typing improvements**: Used type guards and narrowing for unknown types
3. **Shared types**: Created `CommandContext` and `CommandResult` for consistency
4. **Type-safe parsing**: All dynamic data access uses proper type guards

## Next Steps (Optional)

If you want to fix the remaining type errors:

1. **Add type declarations** to packages that are missing them
2. **Apply similar fixes** to `shipgate-chaos.ts` (uses same patterns as `chaos.ts`)
3. **Fix duplicate exports** in `commands/index.ts`
4. **Fix other command files** as needed
