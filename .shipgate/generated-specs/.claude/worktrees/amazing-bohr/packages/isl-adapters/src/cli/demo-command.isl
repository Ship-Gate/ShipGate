# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: add, multiply, clamp, runDemoCommand, formatDemoOutput, printDemoInfo, APP_NAME, VERSION, MAX_RETRIES, TIMEOUT_MS, DemoCommandOptions, DemoResult
# dependencies: fs/promises, path, express

domain DemoCommand {
  version: "1.0.0"

  type DemoCommandOptions = String
  type DemoResult = String

  invariants exports_present {
    - true
  }
}
