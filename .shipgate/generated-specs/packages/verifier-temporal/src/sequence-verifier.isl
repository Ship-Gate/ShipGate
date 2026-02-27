# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: verifySequenceRule, verifySequenceRules, DurationLiteral, SequenceRuleType, SequenceRule, BeforeRule, CooldownRule, RetryRule, TimeWindowRule, SequenceRuleUnion, EventMatcher, SequenceVerificationResult, SequenceViolation, SequenceEvidence
# dependencies: 

domain SequenceVerifier {
  version: "1.0.0"

  type DurationLiteral = String
  type SequenceRuleType = String
  type SequenceRule = String
  type BeforeRule = String
  type CooldownRule = String
  type RetryRule = String
  type TimeWindowRule = String
  type SequenceRuleUnion = String
  type EventMatcher = String
  type SequenceVerificationResult = String
  type SequenceViolation = String
  type SequenceEvidence = String

  invariants exports_present {
    - true
  }
}
