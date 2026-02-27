# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: CoreEventKind, LoginEventKind, TraceEventKind, TimingInfo, TraceEvent, HandlerCallEvent, HandlerReturnEvent, HandlerErrorEvent, StateChangeEvent, CheckEvent, RateLimitCheckedEvent, AuditWrittenEvent, SessionCreatedEvent, UserUpdatedEvent, ErrorReturnedEvent, LoginTraceEvent, Trace, TraceMetadata, LoginTraceMetadata
# dependencies: 

domain Types {
  version: "1.0.0"

  type CoreEventKind = String
  type LoginEventKind = String
  type TraceEventKind = String
  type TimingInfo = String
  type TraceEvent = String
  type HandlerCallEvent = String
  type HandlerReturnEvent = String
  type HandlerErrorEvent = String
  type StateChangeEvent = String
  type CheckEvent = String
  type RateLimitCheckedEvent = String
  type AuditWrittenEvent = String
  type SessionCreatedEvent = String
  type UserUpdatedEvent = String
  type ErrorReturnedEvent = String
  type LoginTraceEvent = String
  type Trace = String
  type TraceMetadata = String
  type LoginTraceMetadata = String

  invariants exports_present {
    - true
  }
}
