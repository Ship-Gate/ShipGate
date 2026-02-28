# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: runSemanticRules, checkProofCompleteness, SEMANTIC_RULES, SemanticViolation, SemanticRuleConfig, SemanticRule, ProofCompletenessResult
# dependencies: ./performance/cache.js

domain SemanticRules {
  version: "1.0.0"

  type SemanticViolation = String
  type SemanticRuleConfig = String
  type SemanticRule = String
  type ProofCompletenessResult = String

  invariants exports_present {
    - true
  }
}
