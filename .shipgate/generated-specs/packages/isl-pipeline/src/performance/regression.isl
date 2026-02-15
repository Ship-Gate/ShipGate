# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runRegressionTests, DEFAULT_BUDGETS, PerformanceBudget, RegressionTestResult, BudgetViolation, PerformanceRegressionTester
# dependencies: 

domain Regression {
  version: "1.0.0"

  type PerformanceBudget = String
  type RegressionTestResult = String
  type BudgetViolation = String
  type PerformanceRegressionTester = String

  invariants exports_present {
    - true
  }
}
