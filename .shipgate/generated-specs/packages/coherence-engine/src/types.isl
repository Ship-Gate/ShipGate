# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ManifestEntry, ProjectManifest, ParsedImport, ParsedExport, UnresolvedImport, CoherenceCheckResult, CodegenContext
# dependencies: 

domain Types {
  version: "1.0.0"

  type ManifestEntry = String
  type ProjectManifest = String
  type ParsedImport = String
  type ParsedExport = String
  type UnresolvedImport = String
  type CoherenceCheckResult = String
  type CodegenContext = String

  invariants exports_present {
    - true
  }
}
