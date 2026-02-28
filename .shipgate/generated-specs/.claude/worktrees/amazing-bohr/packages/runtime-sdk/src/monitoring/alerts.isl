# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: AlertOptions, AlertRule, AlertSender, Alert, ISLAlerter, MetricsSnapshot
# dependencies: 

domain Alerts {
  version: "1.0.0"

  type AlertOptions = String
  type AlertRule = String
  type AlertSender = String
  type Alert = String
  type ISLAlerter = String
  type MetricsSnapshot = String

  invariants exports_present {
    - true
  }
}
