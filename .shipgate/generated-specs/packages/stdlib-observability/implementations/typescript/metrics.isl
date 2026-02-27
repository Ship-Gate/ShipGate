# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: getDefaultRegistry, setDefaultRegistry, ConsoleMetricExporter, InMemoryMetricExporter, CounterHandle, GaugeHandle, HistogramHandle, SummaryHandle, MetricsRegistry, MetricType, MetricUnit
# dependencies: 

domain Metrics {
  version: "1.0.0"

  type ConsoleMetricExporter = String
  type InMemoryMetricExporter = String
  type CounterHandle = String
  type GaugeHandle = String
  type HistogramHandle = String
  type SummaryHandle = String
  type MetricsRegistry = String

  invariants exports_present {
    - true
  }
}
