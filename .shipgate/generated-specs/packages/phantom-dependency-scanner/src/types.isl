# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ScannerOptions, Finding, ScanResult, WorkspaceInfo, PackageJson, ParsedImport
# dependencies: 

domain Types {
  version: "1.0.0"

  type ScannerOptions = String
  type Finding = String
  type ScanResult = String
  type WorkspaceInfo = String
  type PackageJson = String
  type ParsedImport = String

  invariants exports_present {
    - true
  }
}
