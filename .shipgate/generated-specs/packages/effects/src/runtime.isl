# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createRuntime, registerHandler, addInterceptor, run, createTestRuntime, collectEffects, ExecutionContext, EffectTrace, EffectNotHandledError, TimeoutError
# dependencies: 

domain Runtime {
  version: "1.0.0"

  type ExecutionContext = String
  type EffectTrace = String
  type EffectNotHandledError = String
  type TimeoutError = String

  invariants exports_present {
    - true
  }
}
