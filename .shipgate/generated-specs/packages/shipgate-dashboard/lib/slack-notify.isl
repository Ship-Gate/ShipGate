# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: dispatchSlackNotifications, SlackEvent, RunCompletedPayload, FindingCriticalPayload
# dependencies: @/lib/prisma, @/lib/encryption

domain SlackNotify {
  version: "1.0.0"

  type SlackEvent = String
  type RunCompletedPayload = String
  type FindingCriticalPayload = String

  invariants exports_present {
    - true
  }
}
