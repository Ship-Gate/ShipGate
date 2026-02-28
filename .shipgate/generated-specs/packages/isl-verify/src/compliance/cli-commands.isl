# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateSoc2Report, generateHipaaReport, generatePciDssReport, generateEuAiActReport, printComplianceResult, getComplianceExitCode, ComplianceCommandOptions, ComplianceCommandResult
# dependencies: fs, path

domain CliCommands {
  version: "1.0.0"

  type ComplianceCommandOptions = String
  type ComplianceCommandResult = String

  invariants exports_present {
    - true
  }
}
