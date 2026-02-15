# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: JavaImport, ResolvedDependency, ImportCheckResult, HallucinationReport, JavaResolverOptions
# dependencies: 

domain Types {
  version: "1.0.0"

  type JavaImport = String
  type ResolvedDependency = String
  type ImportCheckResult = String
  type HallucinationReport = String
  type JavaResolverOptions = String

  invariants exports_present {
    - true
  }
}
