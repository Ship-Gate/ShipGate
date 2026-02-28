# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createPythonCompilerContext, compilePythonExpression, compilePythonAssertion, compilePreconditionCheck, compilePostconditionCheck, compileInvariantCheck, PythonCompilerContext
# dependencies: 

domain PythonExpressionCompiler {
  version: "1.0.0"

  type PythonCompilerContext = String

  invariants exports_present {
    - true
  }
}
