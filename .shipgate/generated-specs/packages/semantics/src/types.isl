# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseVersion, formatVersion, compareVersions, isCompatible, SemanticVersion, BinaryOperator, UnaryOperator, Quantifier, TemporalOperator, Value, ValueArray, ValueRecord, BinaryOperatorSemantics, UnaryOperatorSemantics, QuantifierSemantics, TemporalOperatorSemantics, TemporalInterpretation, ValueType, OperandTypeConstraint, VersionedSemantics
# dependencies: 

domain Types {
  version: "1.0.0"

  type SemanticVersion = String
  type BinaryOperator = String
  type UnaryOperator = String
  type Quantifier = String
  type TemporalOperator = String
  type Value = String
  type ValueArray = String
  type ValueRecord = String
  type BinaryOperatorSemantics = String
  type UnaryOperatorSemantics = String
  type QuantifierSemantics = String
  type TemporalOperatorSemantics = String
  type TemporalInterpretation = String
  type ValueType = String
  type OperandTypeConstraint = String
  type VersionedSemantics = String

  invariants exports_present {
    - true
  }
}
