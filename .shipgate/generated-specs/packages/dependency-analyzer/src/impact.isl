# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: analyzeImpact, analyzeRemovalImpact, analyzeTypeChangeImpact, compareGraphs, ChangeType, ImpactNode, ImpactDetail, ImpactAnalysis, ImpactSummary
# dependencies: 

domain Impact {
  version: "1.0.0"

  type ChangeType = String
  type ImpactNode = String
  type ImpactDetail = String
  type ImpactAnalysis = String
  type ImpactSummary = String

  invariants exports_present {
    - true
  }
}
