# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CacheManagerOptions, CacheLookupResult, LastRunEntry, CacheManager
# dependencies: fs/promises, path, fs, @isl-lang/parser

domain CacheManager {
  version: "1.0.0"

  type CacheManagerOptions = String
  type CacheLookupResult = String
  type LastRunEntry = String
  type CacheManager = String

  invariants exports_present {
    - true
  }
}
