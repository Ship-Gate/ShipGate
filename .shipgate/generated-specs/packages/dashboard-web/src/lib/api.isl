# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: api, mockData, Domain, Behavior, VerificationResult, BehaviorResult, TestResult, ConditionResult, DashboardStats
# dependencies: 

domain Api {
  version: "1.0.0"

  type Domain = String
  type Behavior = String
  type VerificationResult = String
  type BehaviorResult = String
  type TestResult = String
  type ConditionResult = String
  type DashboardStats = String

  invariants exports_present {
    - true
  }
}
