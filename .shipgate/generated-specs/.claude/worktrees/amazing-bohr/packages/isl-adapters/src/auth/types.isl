# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: TriState, UserStatus, UserEntity, SessionEntity, LoginAttemptEntity, AuthFixtureStore, AuthFixtureData, LookupCriteria, AuthAdapter, AuthStateSnapshot, AuthTraceEvent, FixtureAdapterOptions, TraceAdapterOptions, CreateFixtureAdapter, CreateTraceAdapter
# dependencies: 

domain Types {
  version: "1.0.0"

  type TriState = String
  type UserStatus = String
  type UserEntity = String
  type SessionEntity = String
  type LoginAttemptEntity = String
  type AuthFixtureStore = String
  type AuthFixtureData = String
  type LookupCriteria = String
  type AuthAdapter = String
  type AuthStateSnapshot = String
  type AuthTraceEvent = String
  type FixtureAdapterOptions = String
  type TraceAdapterOptions = String
  type CreateFixtureAdapter = String
  type CreateTraceAdapter = String

  invariants exports_present {
    - true
  }
}
