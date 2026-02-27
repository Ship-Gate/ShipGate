# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: Fingerprint, CacheEntryMeta, CacheEntry, CacheSetOptions, CacheGetResult, FileCacheOptions, CacheStats, Cache
# dependencies: 

domain CacheTypes {
  version: "1.0.0"

  type Fingerprint = String
  type CacheEntryMeta = String
  type CacheEntry = String
  type CacheSetOptions = String
  type CacheGetResult = String
  type FileCacheOptions = String
  type CacheStats = String
  type Cache = String

  invariants exports_present {
    - true
  }
}
