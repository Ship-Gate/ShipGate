# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: isDurationValue, isBooleanAnswer, isNumericAnswer, VALID_DURATION_UNITS, QuestionType, AnswerValue, DurationValue, OpenQuestion, AnswerConstraints, Answer, AppliedClarification, UnresolvedQuestion, ClarifySpecInput, ClarifySpecOutput
# dependencies: 

domain ClarifyTypes {
  version: "1.0.0"

  type QuestionType = String
  type AnswerValue = String
  type DurationValue = String
  type OpenQuestion = String
  type AnswerConstraints = String
  type Answer = String
  type AppliedClarification = String
  type UnresolvedQuestion = String
  type ClarifySpecInput = String
  type ClarifySpecOutput = String

  invariants exports_present {
    - true
  }
}
