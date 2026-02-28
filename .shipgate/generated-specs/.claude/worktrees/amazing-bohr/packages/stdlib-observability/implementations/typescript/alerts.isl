# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: evaluateThreshold, getDefaultAlertManager, setDefaultAlertManager, NotificationChannel, ConsoleNotificationChannel, QueryEvaluator, SimpleQueryEvaluator, AlertManager
# dependencies: 

domain Alerts {
  version: "1.0.0"

  type NotificationChannel = String
  type ConsoleNotificationChannel = String
  type QueryEvaluator = String
  type SimpleQueryEvaluator = String
  type AlertManager = String

  invariants exports_present {
    - true
  }
}
