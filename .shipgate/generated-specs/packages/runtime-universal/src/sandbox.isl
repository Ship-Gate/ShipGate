# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createSandbox, ExpressionEvaluator, SafeFunctions, SandboxConfig, EvaluationContext, ISLSandbox, SandboxError, SandboxTimeoutError, ParsedExpression
# dependencies: 

domain Sandbox {
  version: "1.0.0"

  type SandboxConfig = String
  type EvaluationContext = String
  type ISLSandbox = String
  type SandboxError = String
  type SandboxTimeoutError = String
  type ParsedExpression = String

  invariants exports_present {
    - true
  }
}
