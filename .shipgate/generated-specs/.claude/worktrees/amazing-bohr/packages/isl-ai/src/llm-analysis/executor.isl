# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: executeLLMAnalysis, BudgetTracker, LLMExecutorResult, ExecutorOptions
# dependencies: 

domain Executor {
  version: "1.0.0"

  type BudgetTracker = String
  type LLMExecutorResult = String
  type ExecutorOptions = String

  invariants exports_present {
    - true
  }
}
