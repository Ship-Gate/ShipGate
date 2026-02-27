# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: POST, userLogin, processPayment, updateUser, mockLogin, calculateTotal, explainRule, getAllExplanations, formatExplanationMarkdown, formatExplanationTerminal, RuleExplanation, FixPattern, CodeExample
# dependencies: 

domain Explain {
  version: "1.0.0"

  type RuleExplanation = String
  type FixPattern = String
  type CodeExample = String

  invariants exports_present {
    - true
  }
}
