// ============================================================================
// ISL Actor System - Type Definitions
// ============================================================================

/**
 * Actor reference - unique identifier for an actor
 */
export type ActorRef = string & { readonly __brand: 'ActorRef' };

/**
 * Actor path in the hierarchy
 */
export type ActorPath = string & { readonly __brand: 'ActorPath' };

/**
 * Actor address (local or remote)
 */
export interface ActorAddress {
  protocol: 'local' | 'remote';
  host?: string;
  port?: number;
  path: ActorPath;
}

/**
 * Actor state
 */
export type ActorState =
  | 'CREATED'
  | 'STARTING'
  | 'RUNNING'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED'
  | 'RESTARTING';

/**
 * Message envelope
 */
export interface Envelope<M = unknown> {
  id: string;
  sender?: ActorRef;
  recipient: ActorRef;
  message: M;
  timestamp: Date;
  correlationId?: string;
  metadata: Record<string, string>;
}

/**
 * Actor definition
 */
export interface ActorDef<S, M> {
  name: string;
  initialState: S | (() => S);
  receive: MessageHandler<S, M>;
  preStart?: (ctx: ActorContext<S, M>) => void | Promise<void>;
  postStop?: (ctx: ActorContext<S, M>) => void | Promise<void>;
  preRestart?: (ctx: ActorContext<S, M>, error: Error) => void | Promise<void>;
  postRestart?: (ctx: ActorContext<S, M>) => void | Promise<void>;
  supervisionStrategy?: SupervisionStrategy;
}

/**
 * Message handler type
 */
export type MessageHandler<S, M> = (
  state: S,
  message: M,
  ctx: ActorContext<S, M>
) => S | Promise<S> | Behavior<S, M>;

/**
 * Behavior - represents actor's message handling logic
 */
export interface Behavior<S, M> {
  state: S;
  handler?: MessageHandler<S, M>;
  stash?: M[];
}

/**
 * Actor context - available during message processing
 */
export interface ActorContext<S, M> {
  self: ActorRef;
  path: ActorPath;
  sender?: ActorRef;
  state: S;
  parent?: ActorRef;
  children: ActorRef[];
  
  // Message operations
  send<T>(recipient: ActorRef, message: T): void;
  ask<T, R>(recipient: ActorRef, message: T, timeout?: number): Promise<R>;
  reply<T>(message: T): void;
  forward<T>(recipient: ActorRef, message: T): void;
  
  // Lifecycle operations
  spawn<CS, CM>(def: ActorDef<CS, CM>, name?: string): ActorRef;
  stop(ref?: ActorRef): void;
  watch(ref: ActorRef): void;
  unwatch(ref: ActorRef): void;
  
  // Behavior operations
  become(handler: MessageHandler<S, M>): Behavior<S, M>;
  unbecome(): Behavior<S, M>;
  stash(): void;
  unstashAll(): void;
  
  // Scheduling
  scheduleOnce<T>(delay: number, message: T, recipient?: ActorRef): Cancellable;
  scheduleRepeatedly<T>(
    initialDelay: number,
    interval: number,
    message: T,
    recipient?: ActorRef
  ): Cancellable;
  
  // System access
  system: ActorSystem;
  log: Logger;
}

/**
 * Cancellable scheduled task
 */
export interface Cancellable {
  cancel(): void;
  isCancelled: boolean;
}

/**
 * Supervision strategy
 */
export type SupervisionStrategy =
  | OneForOneStrategy
  | OneForAllStrategy
  | RestForOneStrategy;

export interface OneForOneStrategy {
  kind: 'OneForOne';
  maxRestarts: number;
  withinDuration: number;
  decider: (error: Error) => SupervisionDirective;
}

export interface OneForAllStrategy {
  kind: 'OneForAll';
  maxRestarts: number;
  withinDuration: number;
  decider: (error: Error) => SupervisionDirective;
}

export interface RestForOneStrategy {
  kind: 'RestForOne';
  maxRestarts: number;
  withinDuration: number;
  decider: (error: Error) => SupervisionDirective;
}

/**
 * Supervision directive
 */
export type SupervisionDirective = 'RESUME' | 'RESTART' | 'STOP' | 'ESCALATE';

/**
 * System messages
 */
export type SystemMessage =
  | { kind: 'PoisonPill' }
  | { kind: 'Kill' }
  | { kind: 'Watch'; target: ActorRef }
  | { kind: 'Unwatch'; target: ActorRef }
  | { kind: 'Terminated'; actor: ActorRef; reason: string }
  | { kind: 'ChildFailed'; child: ActorRef; error: Error };

/**
 * Actor system configuration
 */
export interface ActorSystemConfig {
  name: string;
  defaultTimeout?: number;
  defaultMailboxSize?: number;
  logLevel?: LogLevel;
  deadLetterHandler?: (envelope: Envelope) => void;
  remoting?: RemotingConfig;
}

/**
 * Remoting configuration
 */
export interface RemotingConfig {
  host: string;
  port: number;
  transport?: 'tcp' | 'websocket';
}

/**
 * Logger interface
 */
export interface Logger {
  trace(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error, ...args: unknown[]): void;
}

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Actor system interface
 */
export interface ActorSystem {
  name: string;
  root: ActorRef;
  
  // Actor operations
  spawn<S, M>(def: ActorDef<S, M>, name?: string): ActorRef;
  stop(ref: ActorRef): Promise<void>;
  lookup(path: ActorPath): ActorRef | undefined;
  
  // Message operations
  send<M>(ref: ActorRef, message: M): void;
  ask<M, R>(ref: ActorRef, message: M, timeout?: number): Promise<R>;
  
  // System operations
  shutdown(): Promise<void>;
  whenTerminated: Promise<void>;
  
  // Extensions
  deadLetters: ActorRef;
  eventStream: EventStream;
  scheduler: Scheduler;
}

/**
 * Event stream for system-wide events
 */
export interface EventStream {
  subscribe<E>(eventType: string, handler: (event: E) => void): Subscription;
  publish<E>(eventType: string, event: E): void;
}

/**
 * Subscription
 */
export interface Subscription {
  unsubscribe(): void;
}

/**
 * Scheduler
 */
export interface Scheduler {
  scheduleOnce(delay: number, task: () => void): Cancellable;
  scheduleRepeatedly(
    initialDelay: number,
    interval: number,
    task: () => void
  ): Cancellable;
}

/**
 * Router types
 */
export type RouterStrategy =
  | 'RoundRobin'
  | 'Random'
  | 'SmallestMailbox'
  | 'Broadcast'
  | 'ScatterGather'
  | 'ConsistentHash';

export interface RouterConfig {
  strategy: RouterStrategy;
  routees: ActorRef[];
  hashMapping?: (message: unknown) => string;
}

/**
 * Persistence types
 */
export interface PersistentEvent<E> {
  sequenceNr: number;
  persistenceId: string;
  event: E;
  timestamp: Date;
  metadata: Record<string, string>;
}

export interface Snapshot<S> {
  sequenceNr: number;
  persistenceId: string;
  state: S;
  timestamp: Date;
}

export interface PersistentActorDef<S, E, M> extends ActorDef<S, M> {
  persistenceId: string;
  applyEvent: (state: S, event: E) => S;
  shouldSnapshot?: (state: S, event: E, sequenceNr: number) => boolean;
  snapshotInterval?: number;
}

/**
 * Cluster types
 */
export interface ClusterMember {
  id: string;
  address: ActorAddress;
  roles: string[];
  status: MemberStatus;
  joinedAt: Date;
}

export type MemberStatus =
  | 'JOINING'
  | 'UP'
  | 'LEAVING'
  | 'EXITING'
  | 'DOWN'
  | 'REMOVED';

export interface ClusterConfig {
  seedNodes: ActorAddress[];
  roles: string[];
  minMembers?: number;
}
