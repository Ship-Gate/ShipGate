# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: RuleContext, RuleFinding, HallucinationRule, RuleSetId
# dependencies: 

domain HallucinationRules {
  version: "1.0.0"

  type RuleContext = String
  type RuleFinding = String
  type HallucinationRule = String
  type RuleSetId = String

  invariants exports_present {
    - true
  }
}
