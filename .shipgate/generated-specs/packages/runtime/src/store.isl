# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: InMemoryStore, TransactionalStore
# dependencies: 

domain Store {
  version: "1.0.0"

  type InMemoryStore = String
  type TransactionalStore = String

  invariants exports_present {
    - true
  }
}
