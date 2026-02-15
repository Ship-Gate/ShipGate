# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createFakeClock, realClock, TIME, Clock, FakeClock, GuardResult, GuardUsage, RateGuardConfig, BudgetGuardConfig, TokenUsage, BudgetUsage, BudgetGuardResult, RateGuard, BudgetGuard, CombinedGuard, CombinedGuardResult, CombinedUsage, GuardEventType, GuardEvent, GuardEventListener
# dependencies: 

domain GuardTypes {
  version: "1.0.0"

  type Clock = String
  type FakeClock = String
  type GuardResult = String
  type GuardUsage = String
  type RateGuardConfig = String
  type BudgetGuardConfig = String
  type TokenUsage = String
  type BudgetUsage = String
  type BudgetGuardResult = String
  type RateGuard = String
  type BudgetGuard = String
  type CombinedGuard = String
  type CombinedGuardResult = String
  type CombinedUsage = String
  type GuardEventType = String
  type GuardEvent = String
  type GuardEventListener = String

  invariants exports_present {
    - true
  }
}
