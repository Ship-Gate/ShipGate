# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SourceLocation, GoImport, GoFindingKind, GoFinding, GoModInfo, GoDependencyCheckResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type SourceLocation = String
  type GoImport = String
  type GoFindingKind = String
  type GoFinding = String
  type GoModInfo = String
  type GoDependencyCheckResult = String

  invariants exports_present {
    - true
  }
}
