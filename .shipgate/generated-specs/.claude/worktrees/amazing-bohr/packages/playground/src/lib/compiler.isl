# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parse, check, Location, CompileError, TypeDefinition, Behavior, Domain, ParseResult, CheckResult
# dependencies: 

domain Compiler {
  version: "1.0.0"

  type Location = String
  type CompileError = String
  type TypeDefinition = String
  type Behavior = String
  type Domain = String
  type ParseResult = String
  type CheckResult = String

  invariants exports_present {
    - true
  }
}
