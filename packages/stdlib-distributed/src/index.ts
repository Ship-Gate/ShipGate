// ============================================================================
// ISL Standard Library - Distributed Computing
// @isl-lang/stdlib-distributed
// ============================================================================

// Shared Types (exported once to avoid conflicts)
export type { NodeId } from './consensus';

// Actor System
export * from './actor';
export * from './actor-system';

// Consensus - Types
export type {
  ConsensusConfig,
  NodeState,
  LogEntry,
  ConsensusState,
  RequestVoteRequest,
  RequestVoteResponse,
  AppendEntriesRequest,
  AppendEntriesResponse,
  ProposalResult,
} from './consensus';

// Consensus - Values
export { RaftNode, createRaftNode } from './consensus';

// CRDTs - Types
export type {
  HybridLogicalClock,
  VectorClock,
  GCounter,
  PNCounter,
  GSet,
  ORSet,
  LWWRegister,
  MVRegister,
} from './crdt';

// CRDTs - Values
export {
  createGCounter,
  incrementGCounter,
  valueGCounter,
  mergeGCounter,
  createPNCounter,
  incrementPNCounter,
  decrementPNCounter,
  valuePNCounter,
  mergePNCounter,
  createGSet,
  addGSet,
  containsGSet,
  mergeGSet,
  createORSet,
  addORSet,
  removeORSet,
  containsORSet,
  valuesORSet,
  mergeORSet,
  createLWWRegister,
  setLWWRegister,
  mergeLWWRegister,
  createMVRegister,
  setMVRegister,
  valuesMVRegister,
  mergeMVRegister,
  createVectorClock,
  incrementVectorClock,
  mergeVectorClocks,
  compareVectorClocks,
  createHLC,
  tickHLC,
  receiveHLC,
} from './crdt';

// Saga / Distributed Transactions
export * from './saga';

// Service Mesh
export * from './service-mesh';

// Leader Election & Distributed Locks - Types
export type {
  LockHandle,
  ElectionResult,
  LeadershipCallback,
  LockAcquireResult,
  LockReleaseResult,
  FencingToken,
} from './coordination';

// Leader Election & Distributed Locks - Values
export {
  DistributedLock,
  LeaderElection,
  createDistributedLock,
  createLeaderElection,
  FencingTokenGenerator,
} from './coordination';
