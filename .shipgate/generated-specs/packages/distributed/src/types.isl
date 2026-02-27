# @tier 3 — Auto-generated utility spec (export-only verification)
# exports: ClusterNode, NodeStatus, NodeRole, ClusterConfig, DistributedLock, LockOptions, ServiceRegistration, HealthCheck, ServiceQuery, DistributedTransaction, TransactionParticipant, TransactionStatus, ParticipantStatus, ShardConfig, ShardRange, ShardStatus, LogEntry, RaftState, CommandMetadata, Command, CommandHandler, QueryMetadata, Query, QueryHandler, EventMetadata, DomainEvent, Aggregate, EventStore, Projection, CircuitBreakerConfig, CircuitBreakerState, RetryPolicy, BulkheadConfig, RateLimiterConfig, SagaContext, SagaStep, Saga, SagaResult
# dependencies: 

domain Types {
  version: "1.0.0"

  type ClusterNode = String
  type NodeStatus = String
  type NodeRole = String
  type ClusterConfig = String
  type DistributedLock = String
  type LockOptions = String
  type ServiceRegistration = String
  type HealthCheck = String
  type ServiceQuery = String
  type DistributedTransaction = String
  type TransactionParticipant = String
  type TransactionStatus = String
  type ParticipantStatus = String
  type ShardConfig = String
  type ShardRange = String
  type ShardStatus = String
  type LogEntry = String
  type RaftState = String
  type CommandMetadata = String
  type Command = String
  type CommandHandler = String
  type QueryMetadata = String
  type Query = String
  type QueryHandler = String
  type EventMetadata = String
  type DomainEvent = String
  type Aggregate = String
  type EventStore = String
  type Projection = String
  type CircuitBreakerConfig = String
  type CircuitBreakerState = String
  type RetryPolicy = String
  type BulkheadConfig = String
  type RateLimiterConfig = String
  type SagaContext = String
  type SagaStep = String
  type Saga = String
  type SagaResult = String

  invariants exports_present {
    - true
  }
}
