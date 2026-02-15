# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: findOrphans, findUnusedOutputEntities, findUncomposedBehaviors, suggestCleanup, OrphanEntity, OrphanBehavior, OrphanType, OrphanAnalysis, OrphanSummary
# dependencies: 

domain Orphans {
  version: "1.0.0"

  type OrphanEntity = String
  type OrphanBehavior = String
  type OrphanType = String
  type OrphanAnalysis = String
  type OrphanSummary = String

  invariants exports_present {
    - true
  }
}
