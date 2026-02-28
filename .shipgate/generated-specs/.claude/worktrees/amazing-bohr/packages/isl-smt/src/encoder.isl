# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createContext, registerEnum, createPrePostContext, islTypeToSort, encodeExpression, encodeCondition, encodeTypeConstraint, EncodingContext, EncodeResult
# dependencies: @isl-lang/prover

domain Encoder {
  version: "1.0.0"

  type EncodingContext = String
  type EncodeResult = String

  invariants exports_present {
    - true
  }
}
