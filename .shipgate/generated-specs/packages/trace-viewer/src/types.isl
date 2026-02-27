# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: EventType, TraceEvent, EventData, CallEventData, ReturnEventData, StateChangeEventData, CheckEventData, ErrorEventData, StackFrame, State, StateSnapshot, Trace, TraceMetadata, ProofBundle, VerificationResult, FailureInfo, PlaybackState, ViewerFilter, ExpressionResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type EventType = String
  type TraceEvent = String
  type EventData = String
  type CallEventData = String
  type ReturnEventData = String
  type StateChangeEventData = String
  type CheckEventData = String
  type ErrorEventData = String
  type StackFrame = String
  type State = String
  type StateSnapshot = String
  type Trace = String
  type TraceMetadata = String
  type ProofBundle = String
  type VerificationResult = String
  type FailureInfo = String
  type PlaybackState = String
  type ViewerFilter = String
  type ExpressionResult = String

  invariants exports_present {
    - true
  }
}
