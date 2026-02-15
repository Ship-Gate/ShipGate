# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createReplayRecorder, createReplayPlayer, parseReplaySession, generateReplaySeed, seedFromString, scenarioResultToReplay, buildReplaySessionFromResults, SeededRNG, ReplaySession, ReplayScenarioResult, ReplayRecorder, ReplayOptions, ReplayResult, ReplayDifference, ReplayPlayer, ReplayStorage, InMemoryReplayStorage
# dependencies: 

domain Replay {
  version: "1.0.0"

  type SeededRNG = String
  type ReplaySession = String
  type ReplayScenarioResult = String
  type ReplayRecorder = String
  type ReplayOptions = String
  type ReplayResult = String
  type ReplayDifference = String
  type ReplayPlayer = String
  type ReplayStorage = String
  type InMemoryReplayStorage = String

  invariants exports_present {
    - true
  }
}
