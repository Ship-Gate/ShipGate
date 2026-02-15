# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CsvExporterOptions, CsvColumn, CsvExporter, StreamingCsvWriter
# dependencies: zlib

domain Csv {
  version: "1.0.0"

  type CsvExporterOptions = String
  type CsvColumn = String
  type CsvExporter = String
  type StreamingCsvWriter = String

  invariants exports_present {
    - true
  }
}
