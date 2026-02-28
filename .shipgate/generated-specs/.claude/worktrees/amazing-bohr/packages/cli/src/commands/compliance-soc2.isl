# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: complianceSOC2, printComplianceSOC2Result, getComplianceSOC2ExitCode, ComplianceSOC2Options, ComplianceSOC2Result
# dependencies: fs, path, chalk, @isl-lang/shipgate-compliance, @isl-lang/compliance/dist/frameworks/soc2.js, @isl-lang/compliance/dist/audit-trail.js, crypto, @isl-lang/parser

domain ComplianceSoc2 {
  version: "1.0.0"

  type ComplianceSOC2Options = String
  type ComplianceSOC2Result = String

  invariants exports_present {
    - true
  }
}
