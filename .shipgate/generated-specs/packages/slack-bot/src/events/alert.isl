# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerAlertEvents, sendAlert, AlertSeverity, AlertEvent
# dependencies: 

domain Alert {
  version: "1.0.0"

  type AlertSeverity = String
  type AlertEvent = String

  invariants exports_present {
    - true
  }
}
