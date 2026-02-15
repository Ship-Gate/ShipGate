# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createFixedClockSkew, createDriftingClock, createClockJump, createOscillatingClock, TimeProvider, SystemTimeProvider, ClockSkewMode, ClockSkewConfig, ClockSkewState, ClockSkewInjector
# dependencies: 

domain ClockSkew {
  version: "1.0.0"

  type TimeProvider = String
  type SystemTimeProvider = String
  type ClockSkewMode = String
  type ClockSkewConfig = String
  type ClockSkewState = String
  type ClockSkewInjector = String

  invariants exports_present {
    - true
  }
}
