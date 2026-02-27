# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateChaosReport, ChaosReport, ChaosReportSummary, ChaosScenarioReport, ChaosReportCoverage, InjectionTypeStats, ChaosReportTiming
# dependencies: 

domain Report {
  version: "1.0.0"

  type ChaosReport = String
  type ChaosReportSummary = String
  type ChaosScenarioReport = String
  type ChaosReportCoverage = String
  type InjectionTypeStats = String
  type ChaosReportTiming = String

  invariants exports_present {
    - true
  }
}
