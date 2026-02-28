# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: createDistributedLock, createLeaderElection, NodeId, LockHandle, ElectionResult, LeadershipCallback, DistributedLock, LockAcquireResult, LockReleaseResult, LeaderElection, FencingToken, FencingTokenGenerator
# dependencies: 

domain Coordination {
  version: "1.0.0"

  type NodeId = String
  type LockHandle = String
  type ElectionResult = String
  type LeadershipCallback = String
  type DistributedLock = String
  type LockAcquireResult = String
  type LockReleaseResult = String
  type LeaderElection = String
  type FencingToken = String
  type FencingTokenGenerator = String

  invariants exports_present {
    - true
  }
}
