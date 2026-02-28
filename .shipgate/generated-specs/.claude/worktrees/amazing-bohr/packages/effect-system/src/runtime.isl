# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: parseEffectAnnotations, createEffectRuntime, registerEffectHandler, addInterceptor, perform, runWithHandler, createFiber, completeFiber, failFiber, fork, join, EffectRuntimeState, EffectInterceptor, UnhandledEffectError, EffectExecutionError
# dependencies: 

domain Runtime {
  version: "1.0.0"

  type EffectRuntimeState = String
  type EffectInterceptor = String
  type UnhandledEffectError = String
  type EffectExecutionError = String

  invariants exports_present {
    - true
  }
}
