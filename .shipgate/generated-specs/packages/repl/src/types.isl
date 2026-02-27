# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: REPLContext, Domain, EntityDefinition, FieldDefinition, BehaviorDefinition, TypeDefinition, EvalResult, Command
# dependencies: 

domain Types {
  version: "1.0.0"

  type REPLContext = String
  type Domain = String
  type EntityDefinition = String
  type FieldDefinition = String
  type BehaviorDefinition = String
  type TypeDefinition = String
  type EvalResult = String
  type Command = String

  invariants exports_present {
    - true
  }
}
