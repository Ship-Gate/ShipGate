# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: calculateHealthScore, calculateScoreFromCounts, calculatePassRate, calculateScoreFromPassRate, getCriticalBlockerReasons, getVerdictFromScore, determineVerdict, buildScores, buildScoresFromPassRate, buildSeverityCounts, buildTypeCounts, buildCommandCounts, buildResult, getScoreColor, getScoreStatus, formatScore, formatVerdict, BuildResultOptions, BuiltResult, VERDICT_THRESHOLDS, SEVERITY_PENALTIES, createEmptySeverityCounts, createEmptyCommandCounts, assertCountsValid, assertScoresValid
# dependencies: 

domain UnifiedScorer {
  version: "1.0.0"

  type BuildResultOptions = String
  type BuiltResult = String

  invariants exports_present {
    - true
  }
}
