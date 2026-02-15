# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MonitorOptions, AlertRule, MetricsCollector, MonitorStats, BehaviorStats, ISLMonitor
# dependencies: 

domain Metrics {
  version: "1.0.0"

  type MonitorOptions = String
  type AlertRule = String
  type MetricsCollector = String
  type MonitorStats = String
  type BehaviorStats = String
  type ISLMonitor = String

  invariants exports_present {
    - true
  }
}
