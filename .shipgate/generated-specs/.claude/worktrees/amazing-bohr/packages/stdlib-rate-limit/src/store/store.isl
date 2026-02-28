# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: storageFactory, StorageUtilsImpl, StorageFactoryImpl
# dependencies: ./memory, ./redis

domain Store {
  version: "1.0.0"

  type StorageUtilsImpl = String
  type StorageFactoryImpl = String

  invariants exports_present {
    - true
  }
}
