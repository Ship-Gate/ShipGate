# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: scanPython, getPythonPatternCount, getPythonPatternsByCategory, PythonScanResult, PythonScanOptions
# dependencies: 

domain Python {
  version: "1.0.0"

  type PythonScanResult = String
  type PythonScanOptions = String

  invariants exports_present {
    - true
  }
}
