# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSegmentProvider, SegmentConfig, SegmentProvider
# dependencies: 

domain Segment {
  version: "1.0.0"

  type SegmentConfig = String
  type SegmentProvider = String

  invariants exports_present {
    - true
  }
}
