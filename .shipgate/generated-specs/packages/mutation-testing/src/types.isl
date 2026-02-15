# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: MutationType, MutantStatus, Mutant, MutantLocation, MutationResult, TestResult, MutationReport, TypeBreakdown, FileBreakdown, MutationConfig, SurvivorAnalysis, SurvivorCause, MutationOperator, MutantCandidate
# dependencies: 

domain Types {
  version: "1.0.0"

  type MutationType = String
  type MutantStatus = String
  type Mutant = String
  type MutantLocation = String
  type MutationResult = String
  type TestResult = String
  type MutationReport = String
  type TypeBreakdown = String
  type FileBreakdown = String
  type MutationConfig = String
  type SurvivorAnalysis = String
  type SurvivorCause = String
  type MutationOperator = String
  type MutantCandidate = String

  invariants exports_present {
    - true
  }
}
