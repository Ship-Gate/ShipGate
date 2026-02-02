---
"@isl-lang/parser": minor
"@isl-lang/typechecker": minor
"@isl-lang/evaluator": minor
"@isl-lang/isl-core": minor
"@isl-lang/isl-compiler": minor
"@isl-lang/cli": minor
"@isl-lang/lsp-server": minor
"@isl-lang/lsp-core": minor
"@isl-lang/vscode": minor
"@isl-lang/verifier-runtime": minor
"@isl-lang/build-runner": minor
"@isl-lang/evidence": minor
"@isl-lang/evidence-html": minor
"@isl-lang/codegen-tests": minor
"@isl-lang/codegen-openapi": minor
"@isl-lang/codegen-graphql": minor
"@isl-lang/codegen-python": minor
"@isl-lang/codegen-go": minor
---

# ISL v1.0 Release

First stable release of the Intent Specification Language toolchain.

## Core Features
- Full ISL parser supporting domains, entities, behaviors, types, and contracts
- Type checker with refinement types and constraints
- Expression evaluator for preconditions and postconditions
- Test scaffold generation for Vitest/Jest
- TypeScript type generation from ISL specs
- Trust score calculation and evidence reports

## CLI Commands
- `isl parse` - Parse ISL files and display AST
- `isl check` - Type check ISL specifications
- `isl gen` - Generate code (TypeScript, OpenAPI, GraphQL)
- `isl verify` - Verify implementations against specs
- `isl build` - Full pipeline: parse → check → gen → verify → evidence
- `isl fmt` - Format ISL files
- `isl lint` - Lint ISL files for best practices
- `isl repl` - Interactive REPL

## Editor Support
- VS Code extension with syntax highlighting
- LSP server for any editor
- Real-time diagnostics and completion

## Known Limitations
- Expression evaluator ~70% complete (some postconditions require manual testing)
- Python/Go codegen generates scaffolds only
- No SMT solver integration yet (planned for v1.2)
