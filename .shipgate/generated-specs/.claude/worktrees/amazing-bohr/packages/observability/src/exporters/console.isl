# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createConsoleExporter, ConsoleExporterOptions, ConsoleSpanExporter
# dependencies: @isl-lang/observability, @isl-lang/observability/exporters/console, @opentelemetry/sdk-trace-base

domain Console {
  version: "1.0.0"

  type ConsoleExporterOptions = String

  invariants exports_present {
    - true
  }
}
