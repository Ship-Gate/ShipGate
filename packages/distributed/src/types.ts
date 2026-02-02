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

// ═══════════════════════════════════════════════════════════════════════════
// CQRS Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Command metadata
 */
export interface CommandMetadata {
  commandId: string;
  timestamp: number;
  correlationId?: string;
  causationId?: string;
  userId?: string;
}

/**
 * Command structure
 */
export interface Command<TPayload = unknown> {
  type: string;
  payload: TPayload;
  metadata: CommandMetadata;
}

/**
 * Command handler
 */
export interface CommandHandler<TPayload = unknown, TResult = unknown> {
  commandType: string;
  handle: (command: Command<TPayload>) => Promise<TResult>;
  validate?: (command: Command<TPayload>) => Promise<boolean>;
}

/**
 * Query metadata
 */
export interface QueryMetadata {
  queryId: string;
  timestamp: number;
  correlationId?: string;
}

/**
 * Query structure
 */
export interface Query<TParams = unknown> {
  type: string;
  params: TParams;
  metadata: QueryMetadata;
}

/**
 * Query handler
 */
export interface QueryHandler<TParams = unknown, TResult = unknown> {
  queryType: string;
  handle: (query: Query<TParams>) => Promise<TResult>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Event Sourcing Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Event metadata
 */
export interface EventMetadata {
  eventId: string;
  version: number;
  timestamp: number;
  correlationId?: string;
  causationId?: string;
  userId?: string;
}

/**
 * Domain event
 */
export interface DomainEvent<TPayload = unknown> {
  type: string;
  aggregateId: string;
  aggregateType: string;
  payload: TPayload;
  metadata: EventMetadata;
}

/**
 * Aggregate
 */
export interface Aggregate<TState = unknown> {
  id: string;
  type: string;
  version: number;
  state: TState;
}

/**
 * Event store interface
 */
export interface EventStore {
  append(events: DomainEvent[]): Promise<void>;
  getEvents(aggregateId: string, fromVersion?: number): Promise<DomainEvent[]>;
  getAllEvents(fromPosition?: number): Promise<DomainEvent[]>;
  subscribe(handler: (event: DomainEvent) => Promise<void>): () => void;
}

/**
 * Projection
 */
export interface Projection<TState = unknown> {
  name: string;
  initialState: TState;
  handlers: Record<string, (state: TState, event: DomainEvent) => TState>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Resilience Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  volumeThreshold?: number;
}

/**
 * Circuit breaker state
 */
export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  successes: number;
  lastFailure?: number;
  lastSuccess?: number;
  nextAttempt?: number;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay?: number;
  backoff: 'fixed' | 'linear' | 'exponential';
  retryOn?: string[];
  ignoreOn?: string[];
}

/**
 * Bulkhead configuration
 */
export interface BulkheadConfig {
  maxConcurrent: number;
  maxQueue: number;
  timeout?: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  limit: number;
  window: number;
  burst?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Saga Types
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Saga context
 */
export interface SagaContext {
  sagaId: string;
  stepIndex: number;
  attempts: number;
  startTime: number;
  metadata: Record<string, unknown>;
}

/**
 * Saga step
 */
export interface SagaStep<TData = unknown> {
  name: string;
  description?: string;
  execute: (data: TData, context: SagaContext) => Promise<TData>;
  compensate: (data: TData, context: SagaContext) => Promise<TData>;
  retryPolicy?: RetryPolicy;
  timeout?: number;
}

/**
 * Saga definition
 */
export interface Saga<TData = unknown> {
  id: string;
  description?: string;
  steps: SagaStep<TData>[];
  timeout?: number;
  compensationOrder?: 'reverse' | 'parallel';
}

/**
 * Saga execution result
 */
export interface SagaResult<TData = unknown> {
  status: 'completed' | 'compensated' | 'failed';
  data: TData;
  completedSteps: string[];
  compensatedSteps: string[];
  failedStep?: string;
  error?: Error;
  duration: number;
}
