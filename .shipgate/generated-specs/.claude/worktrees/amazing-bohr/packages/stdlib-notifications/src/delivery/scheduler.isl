# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ScheduledNotification, InMemoryScheduler
# dependencies: 

domain Scheduler {
  version: "1.0.0"

  type ScheduledNotification = String
  type InMemoryScheduler = String

  invariants exports_present {
    - true
  }
}
