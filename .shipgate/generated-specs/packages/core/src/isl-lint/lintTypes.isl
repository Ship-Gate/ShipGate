# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SECURITY_SENSITIVE_PATTERNS, CRITICAL_BEHAVIOR_PATTERNS, LintSeverity, LintCategory, LintDiagnostic, RelatedLocation, LintResult, LintRuleConfig, LintRule, LintRuleChecker, LintContext, DiagnosticParams, LintOptions, ComparisonOperator, ImpossiblePattern
# dependencies: 

domain LintTypes {
  version: "1.0.0"

  type LintSeverity = String
  type LintCategory = String
  type LintDiagnostic = String
  type RelatedLocation = String
  type LintResult = String
  type LintRuleConfig = String
  type LintRule = String
  type LintRuleChecker = String
  type LintContext = String
  type DiagnosticParams = String
  type LintOptions = String
  type ComparisonOperator = String
  type ImpossiblePattern = String

  invariants exports_present {
    - true
  }
}
