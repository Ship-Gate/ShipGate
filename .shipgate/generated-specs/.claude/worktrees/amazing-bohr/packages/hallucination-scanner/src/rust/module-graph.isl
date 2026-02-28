# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseModDeclarations, buildRustModuleGraph, findUnreachableModules, ModuleGraphOptions
# dependencies: node:fs/promises, node:path

domain ModuleGraph {
  version: "1.0.0"

  type ModuleGraphOptions = String

  invariants exports_present {
    - true
  }
}
