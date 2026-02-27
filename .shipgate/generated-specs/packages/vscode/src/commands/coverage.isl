# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: registerCoverageCommand, getLastCoverageReport, FileCoverage, CoverageReport
# dependencies: vscode, path, child_process, util

domain Coverage {
  version: "1.0.0"

  type FileCoverage = String
  type CoverageReport = String

  invariants exports_present {
    - true
  }
}
