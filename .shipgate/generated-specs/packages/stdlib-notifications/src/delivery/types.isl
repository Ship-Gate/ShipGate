# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DeliveryEvent, DeliveryStats, DeliveryFilter, DeliveryTracker, Scheduler, DispatchConfig, DispatchResult, NotificationStatus
# dependencies: 

domain Types {
  version: "1.0.0"

  type DeliveryEvent = String
  type DeliveryStats = String
  type DeliveryFilter = String
  type DeliveryTracker = String
  type Scheduler = String
  type DispatchConfig = String
  type DispatchResult = String

  invariants exports_present {
    - true
  }
}
