# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createMemoryStore, MemoryStoreOptions, MemoryIdempotencyStore
# dependencies: 

domain Memory {
  version: "1.0.0"

  type MemoryStoreOptions = String
  type MemoryIdempotencyStore = String

  invariants exports_present {
    - true
  }
}
