# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ResolverOptions, ResolvedModule, DependencyGraph, ImportSpec, ImportItemSpec, BundleResult, ResolverError, ResolverWarning, ExportedSymbol, SymbolTable, MergeConflict, DependencyCycle
# dependencies: 

domain Types {
  version: "1.0.0"

  type ResolverOptions = String
  type ResolvedModule = String
  type DependencyGraph = String
  type ImportSpec = String
  type ImportItemSpec = String
  type BundleResult = String
  type ResolverError = String
  type ResolverWarning = String
  type ExportedSymbol = String
  type SymbolTable = String
  type MergeConflict = String
  type DependencyCycle = String

  invariants exports_present {
    - true
  }
}
