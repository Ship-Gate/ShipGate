# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: resolveUnknownsWithSMT, applyResolutions, SMTResolutionConfig, UnknownClauseInput
# dependencies: 

domain SmtResolution {
  version: "1.0.0"

  type SMTResolutionConfig = String
  type UnknownClauseInput = String

  invariants exports_present {
    - true
  }
}
