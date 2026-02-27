# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createChaosEvent, createTimeoutEvent, createRetryEvent, createPartialFailureEvent, bindSpecClause, mapEventToSpec, serializeChaosEvent, deserializeChaosEvent, getEventRegistry, TIMEOUT_EVENTS, RETRY_EVENTS, PARTIAL_FAILURE_EVENTS, ChaosEventCategory, ChaosEventSeverity, SpecClauseRef, ChaosEventDef, ChaosEventParameter, ChaosEvent, ChaosEventOutcome, InvariantViolation, ChaosEventRegistry, SerializedChaosEvent
# dependencies: 

domain ChaosEvents {
  version: "1.0.0"

  type ChaosEventCategory = String
  type ChaosEventSeverity = String
  type SpecClauseRef = String
  type ChaosEventDef = String
  type ChaosEventParameter = String
  type ChaosEvent = String
  type ChaosEventOutcome = String
  type InvariantViolation = String
  type ChaosEventRegistry = String
  type SerializedChaosEvent = String

  invariants exports_present {
    - true
  }
}
