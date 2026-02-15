# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createHistogram, createLatencyHistogram, formatHistogramAscii, getCumulativeDistribution, mergeHistograms, DEFAULT_LATENCY_BOUNDARIES, HistogramBucket, Histogram, HistogramOptions
# dependencies: 

domain Histogram {
  version: "1.0.0"

  type HistogramBucket = String
  type Histogram = String
  type HistogramOptions = String

  invariants exports_present {
    - true
  }
}
