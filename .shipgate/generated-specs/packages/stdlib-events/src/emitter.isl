# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: SyncHandler, AsyncHandler, Handler, Unsubscribe, EventEmitter
# dependencies: 

domain Emitter {
  version: "1.0.0"

  type SyncHandler = String
  type AsyncHandler = String
  type Handler = String
  type Unsubscribe = String
  type EventEmitter = String

  invariants exports_present {
    - true
  }
}
