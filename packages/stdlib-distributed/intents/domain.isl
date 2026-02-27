// ============================================================================
// ISL Standard Library - Distributed Computing Primitives
// @intentos/stdlib-distributed
// ============================================================================
// 
// First-class distributed systems primitives for ISL including:
// - Actor model implementation
// - Distributed consensus
// - CRDTs (Conflict-free Replicated Data Types)
// - Distributed transactions (Saga pattern)
// - Service mesh integration
// - Leader election
// ============================================================================

domain DistributedComputing {
  version: "1.0.0"
  
  // ============================================================================
  // ACTOR SYSTEM
  // ============================================================================
  
  /**
   * Actor reference - an address to send messages to.
   */
  type ActorRef<M> = {
    id: UUID
    path: String
    node: NodeId
  }
  
  type NodeId = String { pattern: /^[a-z0-9-]+$/ }
  
  /**
   * Actor behavior definition.
   */
  type ActorBehavior<S, M> = {
    initial_state: S
    receive: (state: S, message: M, context: ActorContext<M>) -> ActorResult<S>
    on_failure: (error: Error, context: ActorContext<M>) -> SupervisionDecision
  }
  
  type ActorResult<S> = 
    | { tag: "Continue", state: S }
    | { tag: "Stop" }
    | { tag: "Restart" }
  
  enum SupervisionDecision {
    RESUME      // Continue with current state
    RESTART     // Restart actor with initial state
    STOP        // Stop actor permanently
    ESCALATE    // Escalate to parent supervisor
  }
  
  type ActorContext<M> = {
    self: ActorRef<M>
    sender: ActorRef<Any>?
    children: List<ActorRef<Any>>
    parent: ActorRef<Any>?
    system: ActorSystem
  }
  
  /**
   * Actor system configuration.
   */
  entity ActorSystem {
    id: UUID [immutable, unique]
    name: String
    config: ActorSystemConfig
    nodes: List<NodeId>
    created_at: Timestamp [immutable]
  }
  
  type ActorSystemConfig = {
    dispatcher: DispatcherConfig
    supervision: SupervisionStrategy
    cluster: ClusterConfig?
    serialization: SerializationConfig
  }
  
  type DispatcherConfig = {
    type: DispatcherType
    throughput: Int
    pool_size: Int?
  }
  
  enum DispatcherType {
    DEFAULT
    PINNED
    FORK_JOIN
    THREAD_POOL
  }
  
  type SupervisionStrategy = {
    strategy: StrategyType
    max_retries: Int
    within: Duration
  }
  
  enum StrategyType {
    ONE_FOR_ONE       // Only failed child is affected
    ALL_FOR_ONE       // All children are affected
    REST_FOR_ONE      // Failed child and younger siblings affected
  }
  
  // Actor behaviors
  behavior SpawnActor<S, M> {
    description: "Spawn a new actor in the system"
    
    input {
      name: String
      behavior: ActorBehavior<S, M>
      parent: ActorRef<Any>?
    }
    
    output {
      success: ActorRef<M>
      errors {
        NAME_CONFLICT { when: "Actor with name already exists" }
        SYSTEM_OVERLOADED { retriable: true }
      }
    }
  }
  
  behavior SendMessage<M> {
    description: "Send a message to an actor"
    
    input {
      target: ActorRef<M>
      message: M
      reply_to: ActorRef<Any>?
    }
    
    output {
      success: Unit
      errors {
        ACTOR_NOT_FOUND { }
        MAILBOX_FULL { retriable: true }
        SERIALIZATION_ERROR { }
      }
    }
    
    temporal {
      // Fire and forget - no response expected
      response within 10.ms (p99)
    }
  }
  
  behavior Ask<M, R> {
    description: "Send a message and await response"
    
    input {
      target: ActorRef<M>
      message: M
      timeout: Duration
    }
    
    output {
      success: R
      errors {
        ACTOR_NOT_FOUND { }
        TIMEOUT { }
        ACTOR_FAILED { returns: Error }
      }
    }
    
    temporal {
      response within input.timeout
    }
  }
  
  // ============================================================================
  // DISTRIBUTED CONSENSUS
  // ============================================================================
  
  /**
   * Consensus protocol types.
   */
  enum ConsensusProtocol {
    RAFT
    PAXOS
    PBFT      // Byzantine fault tolerant
    VIEWSTAMPED_REPLICATION
  }
  
  /**
   * Consensus group - a set of nodes that agree on values.
   */
  entity ConsensusGroup {
    id: UUID [immutable, unique]
    name: String
    protocol: ConsensusProtocol
    members: List<NodeId>
    leader: NodeId?
    term: Int
    config: ConsensusConfig
  }
  
  type ConsensusConfig = {
    election_timeout_min: Duration
    election_timeout_max: Duration
    heartbeat_interval: Duration
    max_log_entries: Int
    snapshot_threshold: Int
  }
  
  behavior Propose<V> {
    description: "Propose a value to the consensus group"
    
    input {
      group: ConsensusGroup
      value: V
      client_id: String
      sequence: Int
    }
    
    output {
      success: ConsensusResult<V>
      errors {
        NOT_LEADER { returns: { leader: NodeId? } }
        NO_QUORUM { retriable: true }
        PROPOSAL_CONFLICT { }
      }
    }
    
    preconditions {
      input.group.members.length >= 3  // Minimum for consensus
    }
    
    temporal {
      response within 5.seconds (p99)
    }
  }
  
  type ConsensusResult<V> = {
    value: V
    term: Int
    log_index: Int
    committed_at: Timestamp
  }
  
  // ============================================================================
  // CRDTs - Conflict-free Replicated Data Types
  // ============================================================================
  
  /**
   * G-Counter - Grow-only counter.
   */
  type GCounter = {
    node_counts: Map<NodeId, Int>
  }
  
  /**
   * PN-Counter - Positive-Negative counter.
   */
  type PNCounter = {
    positive: GCounter
    negative: GCounter
  }
  
  /**
   * G-Set - Grow-only set.
   */
  type GSet<E> = {
    elements: Set<E>
  }
  
  /**
   * OR-Set - Observed-Remove set.
   */
  type ORSet<E> = {
    elements: Map<E, Set<UUID>>  // Element -> set of add tags
    tombstones: Map<E, Set<UUID>>  // Element -> set of removed tags
  }
  
  /**
   * LWW-Register - Last-Write-Wins register.
   */
  type LWWRegister<V> = {
    value: V
    timestamp: HybridLogicalClock
    node: NodeId
  }
  
  /**
   * MV-Register - Multi-Value register (preserves conflicts).
   */
  type MVRegister<V> = {
    values: List<{ value: V, clock: VectorClock }>
  }
  
  /**
   * Hybrid Logical Clock for ordering.
   */
  type HybridLogicalClock = {
    physical: Timestamp
    logical: Int
    node: NodeId
  }
  
  /**
   * Vector Clock for causality tracking.
   */
  type VectorClock = Map<NodeId, Int>
  
  // CRDT Operations
  behavior CRDTMerge<C> {
    description: "Merge two CRDT states"
    
    input {
      local: C
      remote: C
    }
    
    output {
      success: C
    }
    
    postconditions {
      // Merge is commutative
      merge(input.local, input.remote) == merge(input.remote, input.local)
      // Merge is associative
      // Merge is idempotent
      merge(result, result) == result
    }
  }
  
  // ============================================================================
  // DISTRIBUTED TRANSACTIONS (SAGA)
  // ============================================================================
  
  /**
   * Saga definition for distributed transactions.
   */
  type Saga<T> = {
    id: UUID
    name: String
    steps: List<SagaStep<T>>
    compensation_policy: CompensationPolicy
  }
  
  type SagaStep<T> = {
    name: String
    action: (context: SagaContext<T>) -> SagaStepResult
    compensation: (context: SagaContext<T>) -> CompensationResult
    timeout: Duration
    retry_policy: RetryPolicy?
  }
  
  type SagaContext<T> = {
    saga_id: UUID
    step_index: Int
    data: T
    completed_steps: List<String>
    failed_step: String?
  }
  
  type SagaStepResult =
    | { tag: "Success", data: Any }
    | { tag: "Failure", error: Error, retriable: Boolean }
    | { tag: "Timeout" }
  
  type CompensationResult =
    | { tag: "Compensated" }
    | { tag: "CompensationFailed", error: Error }
    | { tag: "CompensationSkipped", reason: String }
  
  enum CompensationPolicy {
    BACKWARD    // Compensate in reverse order
    FORWARD     // Try to complete forward first
    PARALLEL    // Compensate all in parallel
  }
  
  type RetryPolicy = {
    max_attempts: Int
    backoff: BackoffStrategy
    jitter: Boolean
  }
  
  enum BackoffStrategy {
    CONSTANT
    LINEAR
    EXPONENTIAL
    FIBONACCI
  }
  
  behavior ExecuteSaga<T> {
    description: "Execute a distributed saga"
    
    input {
      saga: Saga<T>
      initial_data: T
    }
    
    output {
      success: SagaResult<T>
      errors {
        SAGA_FAILED { returns: { failed_step: String, compensated: Boolean } }
        COMPENSATION_FAILED { returns: { original_error: Error, compensation_errors: List<Error> } }
      }
    }
    
    temporal {
      // Saga must complete within sum of all step timeouts
      response within saga_total_timeout(input.saga)
      eventually within 1.hour: saga_terminal_state
    }
  }
  
  type SagaResult<T> = {
    saga_id: UUID
    status: SagaStatus
    final_data: T
    completed_steps: List<String>
    duration: Duration
  }
  
  enum SagaStatus {
    COMPLETED
    COMPENSATED
    PARTIALLY_COMPENSATED
  }
  
  // ============================================================================
  // SERVICE MESH
  // ============================================================================
  
  /**
   * Service instance in the mesh.
   */
  entity ServiceInstance {
    id: UUID [immutable, unique]
    service_name: String [indexed]
    version: String
    endpoint: Endpoint
    health: HealthStatus
    metadata: Map<String, String>?
    registered_at: Timestamp [immutable]
    last_heartbeat: Timestamp
  }
  
  type Endpoint = {
    protocol: Protocol
    host: String
    port: Int
    path: String?
  }
  
  enum Protocol { HTTP, HTTPS, GRPC, TCP }
  
  enum HealthStatus { HEALTHY, UNHEALTHY, DRAINING, UNKNOWN }
  
  /**
   * Load balancing strategies.
   */
  enum LoadBalancingStrategy {
    ROUND_ROBIN
    RANDOM
    LEAST_CONNECTIONS
    WEIGHTED_ROUND_ROBIN
    CONSISTENT_HASH
    LOCALITY_AWARE
  }
  
  /**
   * Circuit breaker configuration.
   */
  type CircuitBreakerConfig = {
    failure_threshold: Int
    success_threshold: Int
    timeout: Duration
    half_open_requests: Int
  }
  
  enum CircuitState { CLOSED, OPEN, HALF_OPEN }
  
  behavior ServiceCall<Req, Resp> {
    description: "Call a service through the mesh"
    
    input {
      service: String
      method: String
      request: Req
      timeout: Duration?
      retry_policy: RetryPolicy?
    }
    
    output {
      success: Resp
      errors {
        SERVICE_NOT_FOUND { }
        NO_HEALTHY_INSTANCES { }
        CIRCUIT_OPEN { returns: { retry_after: Duration } }
        TIMEOUT { }
        SERVICE_ERROR { returns: { status: Int, message: String } }
      }
    }
    
    observability {
      metrics {
        service_call_total (counter) by [service, method, status]
        service_call_latency (histogram) by [service, method]
      }
      traces {
        span "service_call" { service, method }
      }
    }
  }
  
  // ============================================================================
  // LEADER ELECTION
  // ============================================================================
  
  /**
   * Leader election state.
   */
  entity LeaderElection {
    id: UUID [immutable, unique]
    name: String [unique]
    current_leader: NodeId?
    term: Int
    lease_expiry: Timestamp?
    candidates: List<NodeId>
  }
  
  behavior ElectLeader {
    description: "Participate in leader election"
    
    input {
      election_name: String
      candidate: NodeId
      lease_duration: Duration
    }
    
    output {
      success: ElectionResult
      errors {
        ELECTION_IN_PROGRESS { }
        LEASE_EXPIRED { }
      }
    }
  }
  
  type ElectionResult = {
    is_leader: Boolean
    leader: NodeId
    term: Int
    lease_expiry: Timestamp
  }
  
  // ============================================================================
  // DISTRIBUTED LOCK
  // ============================================================================
  
  behavior AcquireLock {
    description: "Acquire a distributed lock"
    
    input {
      resource: String
      owner: NodeId
      ttl: Duration
      wait_timeout: Duration?
    }
    
    output {
      success: LockHandle
      errors {
        LOCK_HELD { returns: { holder: NodeId, expires: Timestamp } }
        TIMEOUT { }
      }
    }
    
    postconditions {
      success implies {
        LockHandle.owner == input.owner
        LockHandle.expires > now()
      }
    }
  }
  
  type LockHandle = {
    resource: String
    owner: NodeId
    token: UUID
    acquired_at: Timestamp
    expires: Timestamp
  }
  
  behavior ReleaseLock {
    description: "Release a distributed lock"
    
    input {
      handle: LockHandle
    }
    
    output {
      success: Boolean
      errors {
        LOCK_NOT_HELD { }
        TOKEN_MISMATCH { }
      }
    }
  }
  
  // ============================================================================
  // INVARIANTS
  // ============================================================================
  
  invariants DistributedSafety {
    // At most one leader per election
    forall e: LeaderElection.
      count(nodes where node == e.current_leader) <= 1
    
    // Lock exclusivity
    forall l: LockHandle.
      count(locks where resource == l.resource and not expired) <= 1
    
    // Consensus quorum
    forall g: ConsensusGroup.
      g.members.length >= 2 * max_failures + 1
  }
}
