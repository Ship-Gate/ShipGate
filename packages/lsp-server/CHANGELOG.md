# Changelog

## 1.0.0

### Major Changes

- b67276d: # ISL v1.0.0 Release

  First stable release of the Intent Specification Language toolchain.

  ## Core Features
  - Full ISL parser supporting domains, entities, behaviors, types, and contracts
  - Type checker with refinement types and constraints
  - Expression evaluator (95%) for preconditions and postconditions with tri-state logic
  - Test scaffold generation for Vitest/Jest
  - TypeScript type generation from ISL specs
  - Trust score calculation and evidence reports
  - Proof bundles with evaluator traces and SMT transcripts

  ## CLI Commands
  - `isl init` - Initialize a new ISL project
  - `isl parse` - Parse ISL files and display AST
  - `isl check` - Type check ISL specifications
  - `isl gen` - Generate code (TypeScript, OpenAPI, GraphQL)
  - `isl verify` - Verify implementations against specs
  - `isl gate` - SHIP/NO-SHIP gate with evidence bundle
  - `isl heal` - Automatically fix violations
  - `isl build` - Full pipeline: parse → check → gen → verify → evidence
  - `isl fmt` - Format ISL files
  - `isl lint` - Lint ISL files for best practices
  - `isl repl` - Interactive REPL
  - `isl proof verify` - Verify proof bundle integrity

  ## Editor Support
  - VS Code extension (vscode-islstudio) with syntax highlighting
  - LSP server for any editor
  - Real-time diagnostics and completion
  - Heal Until Ship UI

  ## Proof Bundle Enhancements (v2.1)
  - Evaluator decision traces with unknown reason codes
  - SMT solver transcripts (when --smt enabled)
  - Run metadata for reproducibility
  - Import graph and stdlib version tracking

  ## Verified Output
  - "Verified by ShipGate ✓" badge for passing verification

  ## Known Limitations
  - Python/Go codegen generates scaffolds only (full implementation planned for v1.2)
  - SMT solver requires Z3 for external solver; builtin handles basic cases

### Patch Changes

- Updated dependencies [b67276d]
  - @isl-lang/parser@1.0.0
  - @isl-lang/typechecker@1.0.0
  - @isl-lang/lsp-core@0.1.1
  - @isl-lang/firewall@0.2.1

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-01-31

### Added

- Initial release
- LSP server implementation
- Support for stdio and socket transports
- Full LSP protocol support
- Integration with @isl-lang/lsp-core
