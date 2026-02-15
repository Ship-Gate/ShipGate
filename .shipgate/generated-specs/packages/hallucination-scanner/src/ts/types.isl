# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SourceLocation, TsImport, TsImportKind, TsFindingKind, TsFinding, PackageManifest, TsDependencyCheckResult, x
# dependencies: y

domain Types {
  version: "1.0.0"

  type SourceLocation = String
  type TsImport = String
  type TsImportKind = String
  type TsFindingKind = String
  type TsFinding = String
  type PackageManifest = String
  type TsDependencyCheckResult = String

  invariants exports_present {
    - true
  }
}
