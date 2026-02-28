# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createFraudDetector, defaultFraudRules, FraudCheckInput, Address, FraudDetector, FraudRule, FraudContext, TransactionHistory, IpRiskData, RuleBasedFraudDetector, RiskThresholds, FraudContextProvider, MockFraudContextProvider
# dependencies: 

domain Fraud {
  version: "1.0.0"

  type FraudCheckInput = String
  type Address = String
  type FraudDetector = String
  type FraudRule = String
  type FraudContext = String
  type TransactionHistory = String
  type IpRiskData = String
  type RuleBasedFraudDetector = String
  type RiskThresholds = String
  type FraudContextProvider = String
  type MockFraudContextProvider = String

  invariants exports_present {
    - true
  }
}
