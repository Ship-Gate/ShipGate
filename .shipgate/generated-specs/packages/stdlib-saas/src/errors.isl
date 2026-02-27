# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TenantNotFoundError, FeatureFlagError, PlanLimitExceededError, EntitlementError, OnboardingError, ContextPropagationError, IsolationViolationError
# dependencies: 

domain Errors {
  version: "1.0.0"

  type TenantNotFoundError = String
  type FeatureFlagError = String
  type PlanLimitExceededError = String
  type EntitlementError = String
  type OnboardingError = String
  type ContextPropagationError = String
  type IsolationViolationError = String

  invariants exports_present {
    - true
  }
}
