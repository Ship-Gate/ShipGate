# Release 1.0 Progress

## ✅ Completed

1. **Fixed TypeScript errors in codegen-grpc** - Package typechecks successfully
2. **Fixed Domain/DomainDeclaration mismatches in CLI verify.ts** - Changed to use `Domain` from parser
3. **Fixed duplicate exports in @isl-lang/core** - Resolved conflicts between:
   - `DEFAULT_WEIGHTS` (isl-agent/scoring vs spec-quality)
   - `PolicySeverity` and `PolicyViolation` (policies vs team-config)
4. **Fixed md-to-pdf type declarations** - Added stub type declarations for optional dependency

## ⚠️ Remaining Issues

### CLI Type Errors
The CLI has several type errors related to missing .d.ts files:
- `@isl-lang/proof` - Missing type declarations
- `@isl-lang/build-runner` - Missing type declarations  
- `@isl-lang/import-resolver` - Missing type declarations
- `@isl-lang/semantic-analysis` - Missing type declarations
- `@isl-lang/verifier-chaos` - Missing type declarations
- `@isl-lang/core` - Fixed, but CLI needs rebuild
- Various type mismatches in commands (chaos.ts, check.ts, fmt.ts)

### Build Status
- ✅ Core packages build successfully
- ❌ `dashboard-web` fails (private package, can skip for 1.0)
- ✅ Most production packages build

### Test Status
- Need to run full test suite
- Playground build blocker mentioned in docs

## Next Steps

1. **Fix missing .d.ts files** - Ensure all packages generate declaration files
2. **Fix CLI type errors** - Address remaining type mismatches
3. **Run test suite** - Verify >90% pass rate
4. **Prepare packages for publishing**:
   - Remove `private: true` from production packages
   - Set versions to 1.0.0
   - Ensure all have proper package.json configs
5. **Publish core packages**:
   - @isl-lang/parser
   - @isl-lang/typechecker
   - @isl-lang/evaluator
   - @isl-lang/isl-core
   - @isl-lang/cli (as `shipgate`)
   - Other production packages from experimental.json

## Production Packages to Publish

From `experimental.json`:

### Core
- @isl-lang/parser
- @isl-lang/typechecker
- @isl-lang/evaluator
- @isl-lang/isl-core
- @isl-lang/errors
- @isl-lang/semantics

### CLI
- @isl-lang/cli (publish as `shipgate`)
- @isl-lang/cli-ux
- @isl-lang/repl

### Verification
- @isl-lang/verifier-runtime
- @isl-lang/isl-verify
- @isl-lang/isl-gate
- @isl-lang/isl-proof
- @isl-lang/isl-pbt
- @isl-lang/verifier-chaos
- @isl-lang/verifier-temporal
- @isl-lang/isl-smt

### Codegen
- @isl-lang/codegen
- @isl-lang/codegen-core
- @isl-lang/codegen-openapi
- @isl-lang/codegen-python
- @isl-lang/codegen-graphql

### Pipeline
- @isl-lang/pipeline
- @isl-lang/import-resolver
- @isl-lang/isl-semantic-analysis

### Stdlib
- @isl-lang/isl-stdlib
- @isl-lang/stdlib-core
- @isl-lang/stdlib-auth
- @isl-lang/stdlib-payments
- @isl-lang/stdlib-rate-limit
- @isl-lang/stdlib-idempotency
- @isl-lang/stdlib-cache
- @isl-lang/stdlib-files
- @isl-lang/stdlib-workflow
- @isl-lang/stdlib-scheduling
- @isl-lang/stdlib-messaging
- @isl-lang/stdlib-notifications
- @isl-lang/stdlib-billing
- @isl-lang/stdlib-analytics

### Other
- @isl-lang/trust-score
- @isl-lang/core (if ready)
