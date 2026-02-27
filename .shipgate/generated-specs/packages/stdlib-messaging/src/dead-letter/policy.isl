# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: DefaultDeadLetterPolicies, BackoffCalculator, DeadLetterPolicyBuilder, DeadLetterPolicyValidator
# dependencies: 

domain Policy {
  version: "1.0.0"

  type BackoffCalculator = String
  type DeadLetterPolicyBuilder = String
  type DeadLetterPolicyValidator = String

  invariants exports_present {
    - true
  }
}
