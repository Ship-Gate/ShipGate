# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createScope, createContext, registerHandler, findHandler, perform, runWith, runPure, inferEffects, checkEffectsHandled, validateHandlers, effectAlgebra, EffectNotHandledError, ResourceLeakError
# dependencies: 

domain Core {
  version: "1.0.0"

  type EffectNotHandledError = String
  type ResourceLeakError = String

  invariants exports_present {
    - true
  }
}
