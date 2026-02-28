# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DEFAULT_OPTIONS, Verdict, CoverageCategory, ChaosTestResult, ExporterOptions, CoverageInfo, VerifyMetricResult, ChaosMetricResult, LatencyMetric, TrustScoreMetric, Exporter, MetricLabels
# dependencies: 

domain Types {
  version: "1.0.0"

  type Verdict = String
  type CoverageCategory = String
  type ChaosTestResult = String
  type ExporterOptions = String
  type CoverageInfo = String
  type VerifyMetricResult = String
  type ChaosMetricResult = String
  type LatencyMetric = String
  type TrustScoreMetric = String
  type Exporter = String
  type MetricLabels = String

  invariants exports_present {
    - true
  }
}
