# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: estimatedFalsePositiveRate, BloomFilterOptions, BloomFilter
# dependencies: node:crypto

domain Bloom {
  version: "1.0.0"

  type BloomFilterOptions = String
  type BloomFilter = String

  invariants exports_present {
    - true
  }
}
