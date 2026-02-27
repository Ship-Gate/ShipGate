# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SourceLocation, RustUse, CargoPackage, CargoDependencyValue, CargoManifest, RustModuleNode, RustModuleGraph, RustFindingKind, RustFinding, RustDependencyCheckResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type SourceLocation = String
  type RustUse = String
  type CargoPackage = String
  type CargoDependencyValue = String
  type CargoManifest = String
  type RustModuleNode = String
  type RustModuleGraph = String
  type RustFindingKind = String
  type RustFinding = String
  type RustDependencyCheckResult = String

  invariants exports_present {
    - true
  }
}
