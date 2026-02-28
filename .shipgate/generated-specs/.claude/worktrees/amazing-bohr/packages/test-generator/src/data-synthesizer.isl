# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: generateSeed, synthesizeInputs, SynthesizedInput, DataTrace, ConstraintSummary, ExpectedOutcome, TypeConstraints, CrossFieldConstraint, SynthesisOptions, SeededRandom, extractConstraints, generateTypicalValue, generateRandomValidValue, generateBoundaryValuesForField, generateInvalidValuesForField, generateArrayValue, generateArrayBoundaryValues, generateStringFromPattern, extractCrossFieldConstraints, applyCrossFieldConstraints, FORMAT_GENERATORS
# dependencies: 

domain DataSynthesizer {
  version: "1.0.0"

  type SynthesizedInput = String
  type DataTrace = String
  type ConstraintSummary = String
  type ExpectedOutcome = String
  type TypeConstraints = String
  type CrossFieldConstraint = String
  type SynthesisOptions = String

  invariants exports_present {
    - true
  }
}
