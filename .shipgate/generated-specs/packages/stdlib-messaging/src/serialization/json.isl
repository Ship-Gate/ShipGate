# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: JsonSerializer, SafeJsonSerializer, StreamingJsonSerializer
# dependencies: 

domain Json {
  version: "1.0.0"

  type JsonSerializer = String
  type SafeJsonSerializer = String
  type StreamingJsonSerializer = String

  invariants exports_present {
    - true
  }
}
