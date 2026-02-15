# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createContext, compileToIR, compileToIRRaw, CompilerContext, CompilerError
# dependencies: 

domain AstToIr {
  version: "1.0.0"

  type CompilerContext = String
  type CompilerError = String

  invariants exports_present {
    - true
  }
}
