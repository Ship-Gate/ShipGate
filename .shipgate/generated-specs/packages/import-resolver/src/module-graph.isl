# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: buildModuleGraph, getMergedAST, hasCircularDependencies, formatGraphDebug, UseStatementSpec, AliasedImport, GraphModule, ModuleGraph, ModuleGraphDebug, ASTCacheEntry, ASTCache, ModuleGraphOptions, ModuleGraphBuilder
# dependencies: node:path, node:fs/promises, @isl-lang/parser

domain ModuleGraph {
  version: "1.0.0"

  type UseStatementSpec = String
  type AliasedImport = String
  type GraphModule = String
  type ModuleGraph = String
  type ModuleGraphDebug = String
  type ASTCacheEntry = String
  type ASTCache = String
  type ModuleGraphOptions = String
  type ModuleGraphBuilder = String

  invariants exports_present {
    - true
  }
}
