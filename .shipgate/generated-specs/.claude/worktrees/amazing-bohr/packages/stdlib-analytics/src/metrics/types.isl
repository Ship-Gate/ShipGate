# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MetricType, MetricLabels, MetricSnapshot, HistogramSnapshot, CounterSnapshot, GaugeSnapshot
# dependencies: 

domain Types {
  version: "1.0.0"

  type MetricType = String
  type MetricLabels = String
  type MetricSnapshot = String
  type HistogramSnapshot = String
  type CounterSnapshot = String
  type GaugeSnapshot = String

  invariants exports_present {
    - true
  }
}
