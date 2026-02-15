# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: resolveImports, ImportResolver
# dependencies: node:fs/promises, node:path, @isl-lang/parser

domain Resolver {
  version: "1.0.0"

  type ImportResolver = String

  invariants exports_present {
    - true
  }
}
