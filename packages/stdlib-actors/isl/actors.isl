// ============================================================================
// ISL Actor System - Standard Library
// Distributed computing with actors, message passing, and supervision
// ============================================================================

domain Actors
version "0.1.0"
owner "IntentOS"

// ============================================================================
// CORE ACTOR TYPES
// ============================================================================

/**
 * Unique identifier for an actor
 */
type ActorRef = UUID {
  @immutable
  @system_generated
}

/**
 * Actor address - can be local or remote
 */
type ActorAddress = String {
  format: /^(local|remote):\/\/[\w.-]+(:\d+)?\/[\w\/.-]+$/
}

/**
 * Actor path in the hierarchy
 */
type ActorPath = String {
  format: /^\/[\w\/.-]+$/
}

/**
 * Message envelope - wraps all messages
 */
type Envelope<M> = {
  id: UUID
  sender: Optional<ActorRef>
  recipient: ActorRef
  message: M
  timestamp: Timestamp
  correlationId: Optional<UUID>
  metadata: Map<String, String>
}

/**
 * Actor state
 */
type ActorState = enum {
  CREATED
  STARTING
  RUNNING
  STOPPING
  STOPPED
  FAILED
  RESTARTING
}

// ============================================================================
// ACTOR DEFINITION
// ============================================================================

/**
 * Actor entity - represents a running actor instance
 */
entity Actor {
  id: ActorRef
  path: ActorPath
  state: ActorState
  parent: Optional<ActorRef>
  children: List<ActorRef>
  mailboxSize: Int
  processedMessages: Int
  createdAt: Timestamp
  lastMessageAt: Optional<Timestamp>
  
  @private
  behavior: String  // Current behavior name
  
  @private
  internalState: Any  // Actor's internal state
  
  lifecycle {
    states: [CREATED, STARTING, RUNNING, STOPPING, STOPPED, FAILED, RESTARTING]
    transitions {
      CREATED -> STARTING via Start
      STARTING -> RUNNING via Started
      STARTING -> FAILED via StartFailed
      RUNNING -> STOPPING via Stop
      RUNNING -> FAILED via Crash
      STOPPING -> STOPPED via Stopped
      FAILED -> RESTARTING via Restart
      RESTARTING -> STARTING via Restarted
    }
  }
  
  invariant mailboxSize >= 0
  invariant processedMessages >= 0
}

// ============================================================================
// SUPERVISION
// ============================================================================

/**
 * Supervision strategy
 */
type SupervisionStrategy = enum {
  ONE_FOR_ONE      // Only restart the failed child
  ONE_FOR_ALL      // Restart all children
  REST_FOR_ONE     // Restart failed child and all younger siblings
  ESCALATE         // Escalate to parent
}

/**
 * Supervision directive
 */
type SupervisionDirective = enum {
  RESUME           // Resume processing with same state
  RESTART          // Restart actor with fresh state
  STOP             // Stop the actor permanently
  ESCALATE         // Escalate to parent supervisor
}

/**
 * Supervision policy
 */
type SupervisionPolicy = {
  strategy: SupervisionStrategy
  maxRestarts: Int { min: 0 }
  withinDuration: Duration
  decider: (error: ActorError) -> SupervisionDirective
}

// ============================================================================
// MESSAGES
// ============================================================================

/**
 * System messages
 */
type SystemMessage = union {
  | PoisonPill               // Graceful shutdown
  | Kill                     // Immediate termination
  | Watch { target: ActorRef }
  | Unwatch { target: ActorRef }
  | Terminated { actor: ActorRef, reason: String }
  | ChildFailed { child: ActorRef, error: ActorError }
}

/**
 * Actor error
 */
type ActorError = {
  message: String
  cause: Optional<String>
  stack: Optional<String>
  timestamp: Timestamp
  actorPath: ActorPath
}

// ============================================================================
// BEHAVIORS
// ============================================================================

/**
 * Spawn a new actor
 */
behavior SpawnActor {
  description: "Create a new actor as a child of the current actor"
  
  input {
    name: String { min_length: 1, max_length: 100 }
    behavior: String  // Initial behavior name
    initialState: Optional<Any>
    supervisionPolicy: Optional<SupervisionPolicy>
  }
  
  output {
    success: ActorRef
    errors {
      ActorNameTaken when "Actor with this name already exists"
      InvalidBehavior when "Unknown behavior"
      MaxChildrenReached when "Maximum number of children reached"
    }
  }
  
  effects {
    creates Actor
  }
  
  postcondition {
    Actor.exists(output)
    Actor.state(output) == CREATED
    Actor.parent(output) == self
  }
}

/**
 * Send a message to an actor
 */
behavior Send<M> {
  description: "Send a message to an actor (fire-and-forget)"
  
  input {
    recipient: ActorRef
    message: M
    delay: Optional<Duration>
  }
  
  output {
    success: Void
    errors {
      ActorNotFound when "Recipient actor does not exist"
      MailboxFull when "Recipient's mailbox is full"
    }
  }
  
  effects {
    creates Envelope<M>
  }
}

/**
 * Send and await response
 */
behavior Ask<M, R> {
  description: "Send a message and await a response"
  
  input {
    recipient: ActorRef
    message: M
    timeout: Duration { min: 1ms, max: 1h }
  }
  
  output {
    success: R
    errors {
      ActorNotFound when "Recipient actor does not exist"
      Timeout when "Response not received within timeout"
      ActorTerminated when "Actor terminated before responding"
    }
  }
  
  temporal {
    response within timeout
  }
}

/**
 * Watch an actor for termination
 */
behavior Watch {
  description: "Register to receive Terminated message when target stops"
  
  input {
    target: ActorRef
  }
  
  output {
    success: Void
    errors {
      ActorNotFound when "Target actor does not exist"
      AlreadyWatching when "Already watching this actor"
    }
  }
}

/**
 * Stop an actor
 */
behavior StopActor {
  description: "Gracefully stop an actor"
  
  input {
    target: ActorRef
    reason: Optional<String>
  }
  
  output {
    success: Void
    errors {
      ActorNotFound when "Target actor does not exist"
      NotAuthorized when "Not authorized to stop this actor"
    }
  }
  
  effects {
    updates Actor
  }
  
  postcondition {
    Actor.state(target) == STOPPED or Actor.state(target) == STOPPING
  }
}

/**
 * Become a different behavior
 */
behavior Become {
  description: "Switch to a different message handling behavior"
  
  input {
    behavior: String  // New behavior name
    discardStash: Optional<Boolean>
  }
  
  output {
    success: Void
    errors {
      InvalidBehavior when "Unknown behavior"
    }
  }
}

/**
 * Stash current message
 */
behavior Stash {
  description: "Stash current message for later processing"
  
  input {}
  
  output {
    success: Void
    errors {
      StashFull when "Stash capacity reached"
    }
  }
}

/**
 * Unstash all messages
 */
behavior UnstashAll {
  description: "Prepend all stashed messages to mailbox"
  
  input {}
  
  output {
    success: Int  // Number of unstashed messages
  }
}

// ============================================================================
// DISTRIBUTED ACTORS
// ============================================================================

/**
 * Cluster member
 */
entity ClusterMember {
  id: UUID
  address: ActorAddress
  roles: List<String>
  status: MemberStatus
  joinedAt: Timestamp
  seenBy: List<UUID>
  
  lifecycle {
    states: [JOINING, UP, LEAVING, EXITING, DOWN, REMOVED]
    transitions {
      JOINING -> UP via MemberUp
      UP -> LEAVING via Leave
      LEAVING -> EXITING via Exit
      EXITING -> DOWN via MemberDown
      EXITING -> REMOVED via Remove
      DOWN -> REMOVED via Remove
    }
  }
}

type MemberStatus = enum {
  JOINING
  UP
  LEAVING
  EXITING
  DOWN
  REMOVED
}

/**
 * Cluster singleton
 */
behavior ClusterSingleton {
  description: "Ensure only one instance runs across the cluster"
  
  input {
    name: String
    behavior: String
    role: Optional<String>  // Run only on nodes with this role
  }
  
  output {
    success: ActorRef
    errors {
      AlreadyExists when "Singleton already exists"
    }
  }
}

/**
 * Cluster sharding
 */
behavior ShardedActor {
  description: "Create a sharded actor entity"
  
  input {
    typeName: String
    entityId: String
    message: Any
  }
  
  output {
    success: Any
    errors {
      ShardUnavailable when "Shard is not available"
    }
  }
}

// ============================================================================
// PATTERNS
// ============================================================================

/**
 * Router - distribute messages across routees
 */
type RouterStrategy = enum {
  ROUND_ROBIN
  RANDOM
  SMALLEST_MAILBOX
  BROADCAST
  SCATTER_GATHER
  CONSISTENT_HASH
}

behavior CreateRouter {
  description: "Create a router with routees"
  
  input {
    name: String
    strategy: RouterStrategy
    routeeCount: Int { min: 1, max: 1000 }
    routeeBehavior: String
  }
  
  output {
    success: ActorRef
  }
}

/**
 * Circuit breaker
 */
entity CircuitBreaker {
  id: UUID
  state: CircuitState
  failureCount: Int
  successCount: Int
  lastFailure: Optional<Timestamp>
  
  lifecycle {
    states: [CLOSED, OPEN, HALF_OPEN]
    transitions {
      CLOSED -> OPEN via TooManyFailures
      OPEN -> HALF_OPEN via ResetTimeout
      HALF_OPEN -> CLOSED via Success
      HALF_OPEN -> OPEN via Failure
    }
  }
  
  invariant failureCount >= 0
  invariant successCount >= 0
}

type CircuitState = enum {
  CLOSED      // Normal operation
  OPEN        // Rejecting requests
  HALF_OPEN   // Testing if service recovered
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Persistent actor event
 */
type PersistentEvent<E> = {
  sequenceNr: Int
  persistenceId: String
  event: E
  timestamp: Timestamp
  metadata: Map<String, String>
}

/**
 * Snapshot
 */
type Snapshot<S> = {
  sequenceNr: Int
  persistenceId: String
  state: S
  timestamp: Timestamp
}

/**
 * Persist an event
 */
behavior Persist<E> {
  description: "Persist an event to the journal"
  
  input {
    event: E
    onPersisted: Optional<() -> Void>
  }
  
  output {
    success: Int  // Sequence number
    errors {
      PersistenceFailure when "Failed to persist event"
    }
  }
}

/**
 * Save snapshot
 */
behavior SaveSnapshot<S> {
  description: "Save a snapshot of current state"
  
  input {
    state: S
  }
  
  output {
    success: Void
    errors {
      SnapshotFailure when "Failed to save snapshot"
    }
  }
}

// ============================================================================
// INVARIANTS
// ============================================================================

invariants ActorSystemInvariants {
  // Every actor has a valid parent (except root)
  forall a: Actor where a.path != "/" =>
    a.parent is not null and Actor.exists(a.parent)
  
  // Running actors must have been started
  forall a: Actor where a.state == RUNNING =>
    a.lastMessageAt is not null implies a.lastMessageAt >= a.createdAt
  
  // Stopped actors cannot have running children
  forall a: Actor where a.state == STOPPED =>
    forall c: Actor where c.parent == a.id => c.state == STOPPED
  
  // Mailbox size is bounded
  forall a: Actor => a.mailboxSize <= 10000
}
