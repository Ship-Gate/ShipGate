# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createModuleId, isRelativePath, isStdlibModule, isScopedPackage, parseModuleSpecifier, inferStdlibCategory, createEmptyGraph, DEFAULT_RESOLVER_CONFIG, ModuleId, ModulePath, ImportEdge, ExportKind, ExportedSymbol, ResolvedModule, ModuleGraph, ResolverConfig, ResolutionResult, GraphBuildResult, VersionConflict, StdlibCategory, StdlibModuleInfo
# dependencies: 

domain Types {
  version: "1.0.0"

  type ModuleId = String
  type ModulePath = String
  type ImportEdge = String
  type ExportKind = String
  type ExportedSymbol = String
  type ResolvedModule = String
  type ModuleGraph = String
  type ResolverConfig = String
  type ResolutionResult = String
  type GraphBuildResult = String
  type VersionConflict = String
  type StdlibCategory = String
  type StdlibModuleInfo = String

  invariants exports_present {
    - true
  }
}
