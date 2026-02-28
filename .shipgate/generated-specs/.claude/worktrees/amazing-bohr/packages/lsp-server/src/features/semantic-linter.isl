# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: LINT_RULES, LintRule, LintResult, QuickfixData, ISLSemanticLinter
# dependencies: @isl-lang/lsp-core

domain SemanticLinter {
  version: "1.0.0"

  type LintRule = String
  type LintResult = String
  type QuickfixData = String
  type ISLSemanticLinter = String

  invariants exports_present {
    - true
  }
}
