# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultPathSanitizer, NoOpAccessController, MemoryStorageCache
# dependencies: events

domain Adapter {
  version: "1.0.0"

  type DefaultPathSanitizer = String
  type NoOpAccessController = String
  type MemoryStorageCache = String

  invariants exports_present {
    - true
  }
}
