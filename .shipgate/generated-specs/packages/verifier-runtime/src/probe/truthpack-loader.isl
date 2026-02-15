# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: loadTruthpack, filterRoutes, getSafeRoutes, getAuthRoutes, getPublicRoutes, deduplicateRoutes, LoadTruthpackResult
# dependencies: fs, path

domain TruthpackLoader {
  version: "1.0.0"

  type LoadTruthpackResult = String

  invariants exports_present {
    - true
  }
}
