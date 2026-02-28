# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: useProjects, useRuns, useRun, useOverview, useFindingsBreakdown, useProfile, ProjectSummary, RunSummary, RunDetail, FindingItem, ProofItem, ArtifactItem, OverviewMetrics, UserProfile
# dependencies: 

domain UseData {
  version: "1.0.0"

  type ProjectSummary = String
  type RunSummary = String
  type RunDetail = String
  type FindingItem = String
  type ProofItem = String
  type ArtifactItem = String
  type OverviewMetrics = String
  type UserProfile = String

  invariants exports_present {
    - true
  }
}
