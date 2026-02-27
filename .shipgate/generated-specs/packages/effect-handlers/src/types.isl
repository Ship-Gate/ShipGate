# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: evidence, EffectSignature, EffectOperation, EffectLaw, Eff, EffectRow, Pure, EffectRequest, Handler, HandlerOperations, HandlerClause, DeepHandler, ShallowHandler, Evidence, RemoveEffect, AddEffect, HasEffect, MergeEffects, Continuation, Resumption, Fiber, FiberStatus, ScheduleId
# dependencies: 

domain Types {
  version: "1.0.0"

  type EffectSignature = String
  type EffectOperation = String
  type EffectLaw = String
  type Eff = String
  type EffectRow = String
  type Pure = String
  type EffectRequest = String
  type Handler = String
  type HandlerOperations = String
  type HandlerClause = String
  type DeepHandler = String
  type ShallowHandler = String
  type Evidence = String
  type RemoveEffect = String
  type AddEffect = String
  type HasEffect = String
  type MergeEffects = String
  type Continuation = String
  type Resumption = String
  type Fiber = String
  type FiberStatus = String
  type ScheduleId = String

  invariants exports_present {
    - true
  }
}
