/**
 * Distributed systems type definitions
 */

/**
 * Node in a distributed cluster
 */
export interface ClusterNode {
  id: string;
  address: string;
  port: number;
  status: NodeStatus;
  role: NodeRole;
  metadata: Record<string, unknown>;
  lastHeartbeat: number;
  joinedAt: number;
}

/**
 * Node status
 */
export type NodeStatus = 'healthy' | 'unhealthy' | 'unknown' | 'leaving';

/**
 * Node role
 */
export type NodeRole = 'leader' | 'follower' | 'candidate' | 'observer';

/**
 * Cluster configuration
 */
export interface ClusterConfig {
  nodeId: string;
  address: string;
  port: number;
  seeds: string[];
  heartbeatInterval: number;
  electionTimeout: number;
  replicationFactor: number;
}

/**
 * Distributed lock
 */
export interface DistributedLock {
  key: string;
  owner: string;
  acquiredAt: number;
  expiresAt: number;
  fenceToken: number;
}

/**
 * Lock options
 */
export interface LockOptions {
  ttl: number;
  retryDelay: number;
  maxRetries: number;
  fencing: boolean;
}

/**
 * Service registration
 */
export interface ServiceRegistration {
  id: string;
  name: string;
  version: string;
  address: string;
  port: number;
  protocol: 'http' | 'https' | 'grpc' | 'tcp';
  tags: string[];
  metadata: Record<string, unknown>;
  healthCheck?: HealthCheck;
  registeredAt: number;
  lastHealthCheck?: number;
}

/**
 * Health check configuration
 */
export interface HealthCheck {
  type: 'http' | 'tcp' | 'grpc';
  endpoint?: string;
  interval: number;
  timeout: number;
  deregisterAfter?: number;
}

/**
 * Service query
 */
export interface ServiceQuery {
  name?: string;
  tags?: string[];
  healthy?: boolean;
  version?: string;
}

/**
 * Distributed transaction
 */
export interface DistributedTransaction {
  id: string;
  participants: TransactionParticipant[];
  status: TransactionStatus;
  startedAt: number;
  timeout: number;
  coordinator: string;
}

/**
 * Transaction participant
 */
export interface TransactionParticipant {
  nodeId: string;
  resource: string;
  status: ParticipantStatus;
  vote?: 'commit' | 'abort';
}

/**
 * Transaction status
 */
export type TransactionStatus = 'preparing' | 'prepared' | 'committing' | 'committed' | 'aborting' | 'aborted';

/**
 * Participant status
 */
export type ParticipantStatus = 'pending' | 'prepared' | 'committed' | 'aborted' | 'failed';

/**
 * Shard configuration
 */
export interface ShardConfig {
  id: string;
  range: ShardRange;
  replicas: string[];
  primary: string;
  status: ShardStatus;
}

/**
 * Shard range
 */
export interface ShardRange {
  start: string;
  end: string;
}

/**
 * Shard status
 */
export type ShardStatus = 'active' | 'rebalancing' | 'splitting' | 'merging' | 'inactive';

/**
 * Consensus log entry
 */
export interface LogEntry<T = unknown> {
  index: number;
  term: number;
  command: T;
  timestamp: number;
}

/**
 * Raft state
 */
export interface RaftState {
  currentTerm: number;
  votedFor: string | null;
  log: LogEntry[];
  commitIndex: number;
  lastApplied: number;
  role: NodeRole;
  leader: string | null;
}
