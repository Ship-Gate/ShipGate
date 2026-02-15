# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: analyzeCompliance, AnalysisResult, DataClassification, SensitiveField, SecurityControl, ComplianceIndicator, RiskAssessment, RiskFactor, Recommendation, ComplianceAnalyzer
# dependencies: 

domain Analyzer {
  version: "1.0.0"

  type AnalysisResult = String
  type DataClassification = String
  type SensitiveField = String
  type SecurityControl = String
  type ComplianceIndicator = String
  type RiskAssessment = String
  type RiskFactor = String
  type Recommendation = String
  type ComplianceAnalyzer = String

  invariants exports_present {
    - true
  }
}
