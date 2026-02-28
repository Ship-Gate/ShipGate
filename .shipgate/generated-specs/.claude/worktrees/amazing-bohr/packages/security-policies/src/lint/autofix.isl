# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createAutofixGenerator, generateFix, applyAllFixes, TextEdit, AutofixResult, AutofixGenerator
# dependencies: 

domain Autofix {
  version: "1.0.0"

  type TextEdit = String
  type AutofixResult = String
  type AutofixGenerator = String

  invariants exports_present {
    - true
  }
}
