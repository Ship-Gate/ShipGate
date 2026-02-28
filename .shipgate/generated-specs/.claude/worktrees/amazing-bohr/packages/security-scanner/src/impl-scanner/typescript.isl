# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: scanTypeScript, getTypeScriptPatternCount, getTypeScriptPatternsByCategory, TypeScriptScanResult, TypeScriptScanOptions
# dependencies: crypto

domain Typescript {
  version: "1.0.0"

  type TypeScriptScanResult = String
  type TypeScriptScanOptions = String

  invariants exports_present {
    - true
  }
}
