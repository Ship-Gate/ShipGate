# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: JsonExporterOptions, JsonExporter, NdjsonExporter, StreamingJsonWriter, StreamingNdjsonWriter
# dependencies: 

domain Json {
  version: "1.0.0"

  type JsonExporterOptions = String
  type JsonExporter = String
  type NdjsonExporter = String
  type StreamingJsonWriter = String
  type StreamingNdjsonWriter = String

  invariants exports_present {
    - true
  }
}
