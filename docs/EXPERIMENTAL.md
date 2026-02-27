# Experimental Packages

This document describes the package categorization system used to manage the ISL monorepo without deleting vision packages while maintaining a stable production pipeline.

## Overview

The ISL monorepo contains 196 packages organized into four categories:

| Category | Count | Description |
|----------|-------|-------------|
| **Production** | ~45 | Core verified packages - tested, documented, ready for 1.0 |
| **Partial** | ~35 | Needed for 1.0 but incomplete - real implementation, missing tests |
| **Experimental** | ~105 | Shell/stub packages - marked private, excluded from default build |
| **Internal** | ~10 | Internal UI/web apps - already marked private, not published |

## Package Categories

### Production Packages

These are the core packages that make up the 1.0 release. They:
- Have real implementations with tests
- Are included in `pnpm build:production` and `pnpm typecheck:production`
- Will be published to npm

**Core:**
- `@isl-lang/parser` - ISL language parser
- `@isl-lang/typechecker` - Type checking and validation
- `@isl-lang/evaluator` - Expression evaluation
- `@isl-lang/isl-core` - Core ISL functionality
- `@isl-lang/errors` - Error formatting and catalog

**CLI:**
- `@isl-lang/cli` - Main CLI tool
- `@isl-lang/cli-ux` - CLI user experience utilities
- `@isl-lang/repl` - Interactive REPL

**Pipeline:**
- `@isl-lang/pipeline` - Main ISL pipeline
- `@isl-lang/isl-compiler` - ISL to TypeScript compiler
- `@isl-lang/import-resolver` - Module resolution
- `@isl-lang/isl-expression-evaluator` - Runtime expression evaluation
- `@isl-lang/isl-semantic-analysis` - Semantic analysis passes

**Verification:**
- `@isl-lang/verifier-runtime` - Runtime verification
- `@isl-lang/isl-verify` - Verification pipeline
- `@isl-lang/evidence-schema` - Evidence format schema
- `@isl-lang/isl-gate` - CI/CD gating
- `@isl-lang/isl-healer` - Auto-fix suggestions

**Codegen:**
- `@isl-lang/codegen` - Code generation core
- `@isl-lang/codegen-tests` - Test generation
- `@isl-lang/codegen-openapi` - OpenAPI generation
- `@isl-lang/codegen-python` - Python code generation
- `@isl-lang/codegen-graphql` - GraphQL generation

### Partial Packages

These packages have real implementations but need more work for 1.0:

**Language Codegens (v0.1.0):**
- `@isl-lang/codegen-go` - Go code generation
- `@isl-lang/codegen-rust` - Rust code generation
- `@isl-lang/codegen-csharp` - C# code generation
- `@isl-lang/codegen-jvm` - Java/Kotlin generation

**Stdlib (untested):**
- `@isl-lang/stdlib-api` - API patterns
- `@isl-lang/stdlib-events` - Event sourcing
- `@isl-lang/stdlib-queue` - Job queues
- etc.

### Experimental Packages

These packages are shells/stubs preserved for future development. They are:
- Marked `"private": true` in package.json
- Marked `"experimental": true` in package.json
- Excluded from default build/typecheck
- Not published to npm

**Categories:**
- Advanced features (effect system, formal verification, fuzzing)
- Codegen shells (terraform, wasm, kubernetes, etc.)
- SDK generators (flutter, kotlin, python, swift)
- Platform services (marketplace, dashboard, agent-os)
- Observability integrations (datadog, grafana, prometheus)

## Scripts

### Production Pipeline

```bash
# Build only production packages (excludes experimental)
pnpm build:production

# Typecheck only production packages
pnpm typecheck:production

# Test only production packages
pnpm test:production

# Release (uses production pipeline)
pnpm release
```

### Full Pipeline (includes experimental)

```bash
# Build all packages (may have errors in experimental)
pnpm build

# Typecheck all packages
pnpm typecheck

# Test all packages
pnpm test
```

### Experimental Management

```bash
# List all experimental packages (dry run)
pnpm list:experimental

# Mark new packages as experimental
npx tsx scripts/mark-experimental-private.ts
```

## Adding New Packages

When adding a new package:

1. **Production package**: Add to `experimental.json` under `production` section
2. **Partial package**: Add to `experimental.json` under `partial` section  
3. **Experimental package**: Add to `experimental.json` under `experimental` section and run:
   ```bash
   npx tsx scripts/mark-experimental-private.ts
   ```

## Promoting Experimental to Production

To promote an experimental package to production:

1. Remove from `experimental` section in `experimental.json`
2. Add to `production` or `partial` section
3. Remove `"private": true` and `"experimental": true` from package.json
4. Add the package to the turbo filter in `build:production` script
5. Ensure tests pass

## Configuration Files

| File | Purpose |
|------|---------|
| `experimental.json` | Master categorization of all packages |
| `turbo.json` | Task configuration with production tasks |
| `package.json` | Root scripts with production filters |
| `scripts/mark-experimental-private.ts` | Script to mark packages as private |

## IDE Experience

With experimental packages marked as private:
- TypeScript errors are isolated to experimental packages
- IDE performance improves with fewer type errors
- Production packages have clean typecheck

## Why Not Delete?

Experimental packages are preserved because:
- They represent the product vision and roadmap
- Some have partial implementations that can be completed
- Deleting would lose design decisions and patterns
- Contributors can work on them without starting from scratch
