// ============================================================================
// ISL Standard Library - Distributed Computing
// @isl-lang/stdlib-distributed
// ============================================================================

// Shared Types (exported once to avoid conflicts)
export type { NodeId } from './consensus.js';

// Actor System
export * from './actor.js';
export * from './actor-system.js';

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
} from './consensus.js';

// Consensus - Values
export { RaftNode, createRaftNode } from './consensus.js';

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
} from './crdt.js';

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
} from './crdt.js';

// Saga / Distributed Transactions
export * from './saga.js';

// Service Mesh
export * from './service-mesh.js';

// Leader Election & Distributed Locks - Types
export type {
  LockHandle,
  ElectionResult,
  LeadershipCallback,
  LockAcquireResult,
  LockReleaseResult,
  FencingToken,
} from './coordination.js';

// Leader Election & Distributed Locks - Values
export {
  DistributedLock,
  LeaderElection,
  createDistributedLock,
  createLeaderElection,
  FencingTokenGenerator,
} from './coordination.js';
