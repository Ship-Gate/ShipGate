# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateFromPreconditions, generateFromPostconditions, generateFromRefinements, generateFromInvariants, SourceMappedAssertion, SMTSourceMap, GeneratedSMTLib, SMTLibGeneratorOptions
# dependencies: @isl-lang/prover

domain SmtlibGenerator {
  version: "1.0.0"

  type SourceMappedAssertion = String
  type SMTSourceMap = String
  type GeneratedSMTLib = String
  type SMTLibGeneratorOptions = String

  invariants exports_present {
    - true
  }
}
