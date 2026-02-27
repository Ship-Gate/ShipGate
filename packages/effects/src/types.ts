// ============================================================================
// ISL Effect System - Type Definitions
// Algebraic effects for tracking and controlling side effects
// ============================================================================

// ============================================================================
// Runtime Effect Types (Tagged Union Style)
// ============================================================================

/**
 * Base effect interface with tag discriminator
 */
export interface Effect<T = unknown> {
  readonly _tag: string;
  readonly __result?: T;
}

/**
 * Any effect (used for type-erased effect handling)
 */
export type AnyEffect = 
  | ReadEffect<unknown>
  | WriteEffect<unknown>
  | IOEffect<unknown>
  | NetworkEffect<unknown>
  | DatabaseEffect<unknown>
  | MessageEffect<unknown>
  | LogEffect
  | TimeEffect<unknown>
  | RandomEffect<unknown>
  | EnvEffect<unknown>
  | FileSystemEffect<unknown>
  | ShellEffect<unknown>
  | SequenceEffect<unknown>
  | ParallelEffect<unknown>
  | ConditionalEffect<unknown>
  | RetryEffect<unknown>
  | TimeoutEffect<unknown>
  | CacheEffect<unknown>;

/**
 * Read effect - read from a source
 */
export interface ReadEffect<T> extends Effect<T> {
  readonly _tag: 'Read';
  readonly source: string;
  readonly key?: string;
}

/**
 * Write effect - write to a target
 */
export interface WriteEffect<T> extends Effect<T> {
  readonly _tag: 'Write';
  readonly target: string;
  readonly key?: string;
  readonly value: T;
}

/**
 * IO effect - general input/output
 */
export interface IOEffect<T> extends Effect<T> {
  readonly _tag: 'IO';
  readonly operation: string;
  readonly params?: Record<string, unknown>;
}

/**
 * Network effect - HTTP requests
 */
export interface NetworkEffect<T> extends Effect<T> {
  readonly _tag: 'Network';
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: unknown;
}

/**
 * Database effect - database operations
 */
export interface DatabaseEffect<T> extends Effect<T> {
  readonly _tag: 'Database';
  readonly operation: 'query' | 'insert' | 'update' | 'delete' | 'transaction';
  readonly table?: string;
  readonly query?: string;
  readonly params?: unknown[];
}

/**
 * Message effect - messaging/events
 */
export interface MessageEffect<T> extends Effect<T> {
  readonly _tag: 'Message';
  readonly channel: string;
  readonly topic?: string;
  readonly payload: unknown;
}

/**
 * Log effect - logging
 */
export interface LogEffect extends Effect<void> {
  readonly _tag: 'Log';
  readonly level: 'debug' | 'info' | 'warn' | 'error';
  readonly message: string;
  readonly context?: Record<string, unknown>;
}

/**
 * Time effect - time operations
 */
export interface TimeEffect<T> extends Effect<T> {
  readonly _tag: 'Time';
  readonly operation: 'now' | 'delay' | 'timeout';
  readonly duration?: number;
}

/**
 * Random effect - random number generation
 */
export interface RandomEffect<T> extends Effect<T> {
  readonly _tag: 'Random';
  readonly type: 'number' | 'uuid' | 'bytes' | 'choice';
  readonly options?: {
    min?: number;
    max?: number;
    length?: number;
    choices?: unknown[];
  };
}

/**
 * Environment effect - environment variables
 */
export interface EnvEffect<T> extends Effect<T> {
  readonly _tag: 'Env';
  readonly variable: string;
  readonly required?: boolean;
  readonly default?: T;
}

/**
 * File system effect
 */
export interface FileSystemEffect<T> extends Effect<T> {
  readonly _tag: 'FileSystem';
  readonly operation: 'read' | 'write' | 'delete' | 'exists' | 'list';
  readonly path: string;
  readonly content?: unknown;
}

/**
 * Shell effect - execute shell commands
 */
export interface ShellEffect<T> extends Effect<T> {
  readonly _tag: 'Shell';
  readonly command: string;
  readonly args?: string[];
  readonly cwd?: string;
  readonly env?: Record<string, string>;
}

// ============================================================================
// Effect Composition Types
// ============================================================================

/**
 * Sequence effect - execute effects in order
 */
export interface SequenceEffect<T> extends Effect<T> {
  readonly _tag: 'Sequence';
  readonly effects: Effect<unknown>[];
}

/**
 * Parallel effect - execute effects concurrently
 */
export interface ParallelEffect<T> extends Effect<T[]> {
  readonly _tag: 'Parallel';
  readonly effects: Effect<unknown>[];
}

/**
 * Conditional effect - execute based on condition
 */
export interface ConditionalEffect<T> extends Effect<T> {
  readonly _tag: 'Conditional';
  readonly condition: Effect<boolean>;
  readonly onTrue: Effect<T>;
  readonly onFalse?: Effect<T>;
}

/**
 * Retry policy for retry effects
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly delay: number;
  readonly backoff?: 'none' | 'linear' | 'exponential';
  readonly maxDelay?: number;
  readonly retryOn?: string[];
}

/**
 * Retry effect - retry on failure
 */
export interface RetryEffect<T> extends Effect<T> {
  readonly _tag: 'Retry';
  readonly effect: Effect<T>;
  readonly policy: RetryPolicy;
}

/**
 * Timeout effect - fail after duration
 */
export interface TimeoutEffect<T> extends Effect<T> {
  readonly _tag: 'Timeout';
  readonly effect: Effect<T>;
  readonly duration: number;
  readonly fallback?: T;
}

/**
 * Cache effect - cache result
 */
export interface CacheEffect<T> extends Effect<T> {
  readonly _tag: 'Cache';
  readonly key: string;
  readonly effect: Effect<T>;
  readonly ttl?: number;
}

// ============================================================================
// Runtime Types
// ============================================================================

/**
 * Effect handler function
 */
export type EffectHandler<E extends AnyEffect = AnyEffect, T = unknown> = (effect: E) => T | Promise<T>;

/**
 * Effect interceptor for cross-cutting concerns
 */
export interface EffectInterceptor {
  before?(effect: AnyEffect): AnyEffect | Promise<AnyEffect>;
  after?(effect: AnyEffect, result: unknown): unknown | Promise<unknown>;
  onError?(effect: AnyEffect, error: Error): void | Promise<void>;
}

/**
 * Effect runtime configuration
 */
export interface EffectRuntime {
  handlers: Map<string, EffectHandler<AnyEffect, unknown>>;
  interceptors: EffectInterceptor[];
  logger?: (effect: AnyEffect, result: unknown) => void;
}

// ============================================================================
// Effect Specification Types (for ISL verification)
// ============================================================================

/**
 * Effect constraint for specifications
 */
export interface EffectConstraint {
  tag: string;
  allowed: boolean;
  maxOccurrences?: number;
}

/**
 * Effect specification
 */
export interface EffectSpec {
  name: string;
  description?: string;
  effects: EffectConstraint[];
  forbidden?: string[];
  required?: string[];
}

// ============================================================================
// Algebraic Effect Types (Theory-based)
// ============================================================================

/**
 * Effect kinds - categorize different types of effects
 */
export type EffectKind =
  | 'IO'           // Input/Output operations
  | 'State'        // Mutable state
  | 'Exception'    // Exception handling
  | 'Async'        // Asynchronous operations
  | 'Resource'     // Resource acquisition/release
  | 'Network'      // Network operations
  | 'Database'     // Database operations
  | 'FileSystem'   // File system operations
  | 'Random'       // Non-deterministic operations
  | 'Time'         // Time-dependent operations
  | 'Logging'      // Logging/tracing
  | 'Console'      // Console I/O
  | 'Environment'  // Environment variables
  | 'Process'      // Process operations
  | 'Crypto'       // Cryptographic operations
  | 'Custom';      // User-defined effects

/**
 * Algebraic Effect - represents a single effect definition (for ISL declarations)
 */
export interface AlgebraicEffect {
  kind: EffectKind;
  name: string;
  description?: string;
  operations: EffectOperation[];
  handlers?: AlgebraicEffectHandler[];
}

/**
 * Effect operation - an action that can be performed
 */
export interface EffectOperation {
  name: string;
  parameters: EffectParameter[];
  returnType: EffectType;
  resumable: boolean;  // Can the computation resume after this operation?
  description?: string;
}

/**
 * Effect parameter
 */
export interface EffectParameter {
  name: string;
  type: EffectType;
  optional?: boolean;
}

/**
 * Effect type
 */
export type EffectType =
  | { kind: 'Primitive'; name: string }
  | { kind: 'Generic'; name: string; params: EffectType[] }
  | { kind: 'Function'; params: EffectType[]; returns: EffectType; effects: EffectSet }
  | { kind: 'Union'; types: EffectType[] }
  | { kind: 'Void' }
  | { kind: 'Never' }
  | { kind: 'Any' };

/**
 * Effect set - collection of effects a computation may perform
 */
export interface EffectSet {
  effects: EffectRef[];
  pure?: boolean;  // True if the computation is pure (no effects)
}

/**
 * Effect reference
 */
export interface EffectRef {
  effect: string;
  operations?: string[];  // Specific operations used, or all if undefined
}

/**
 * Algebraic effect handler - handles effect operations (for ISL handlers)
 */
export interface AlgebraicEffectHandler {
  effect: string;
  operation: string;
  implementation: EffectHandlerImpl;
}

/**
 * Handler implementation types
 */
export type EffectHandlerImpl =
  | { kind: 'Native'; fn: (...args: unknown[]) => unknown }
  | { kind: 'Transform'; targetEffect: string; targetOperation: string }
  | { kind: 'Pure'; value: unknown }
  | { kind: 'Resume'; transform?: (value: unknown) => unknown };

/**
 * Effect row - for row polymorphism in effect types
 */
export interface EffectRow {
  known: EffectRef[];
  rest?: string;  // Type variable for remaining effects
}

/**
 * Effectful computation
 */
export interface Effectful<T, E extends EffectSet = EffectSet> {
  __value: T;
  __effects: E;
}

/**
 * Pure computation (no effects)
 */
export type Pure<T> = Effectful<T, { effects: []; pure: true }>;

/**
 * IO effect
 */
export type IO<T> = Effectful<T, { effects: [{ effect: 'IO' }] }>;

/**
 * Async effect
 */
export type Async<T> = Effectful<T, { effects: [{ effect: 'Async' }] }>;

/**
 * State effect
 */
export type Stateful<S, T> = Effectful<T, { effects: [{ effect: 'State', operations: ['get', 'put'] }] }>;

/**
 * Resource effect
 */
export type WithResource<R, T> = Effectful<T, { effects: [{ effect: 'Resource' }] }>;

/**
 * Algebraic effect constraint - ISL syntax for effect bounds
 */
export interface AlgebraicEffectBoundConstraint {
  kind: 'EffectConstraint';
  variable: string;
  bounds: EffectBound[];
}

/**
 * Effect bound
 */
export type EffectBound =
  | { kind: 'Includes'; effect: EffectRef }
  | { kind: 'Excludes'; effect: EffectRef }
  | { kind: 'SubsetOf'; effects: EffectSet }
  | { kind: 'SupersetOf'; effects: EffectSet };

/**
 * Effect inference result
 */
export interface EffectInference {
  success: boolean;
  effects: EffectSet;
  errors: EffectError[];
  warnings: EffectWarning[];
}

/**
 * Effect error
 */
export interface EffectError {
  kind: 'UnhandledEffect' | 'EffectMismatch' | 'InvalidHandler' | 'ResourceLeak';
  message: string;
  location?: { line: number; column: number };
  effect?: EffectRef;
}

/**
 * Effect warning
 */
export interface EffectWarning {
  kind: 'UnusedHandler' | 'RedundantEffect' | 'PossibleLeak';
  message: string;
  location?: { line: number; column: number };
}

/**
 * Effect algebra for composition
 */
export interface EffectAlgebra {
  // Combine two effect sets
  union(a: EffectSet, b: EffectSet): EffectSet;
  
  // Subtract effects (for handlers)
  subtract(total: EffectSet, handled: EffectSet): EffectSet;
  
  // Check if effect set is subset
  isSubset(subset: EffectSet, superset: EffectSet): boolean;
  
  // Check if effect set is pure
  isPure(effects: EffectSet): boolean;
  
  // Get the empty effect set
  empty(): EffectSet;
}

/**
 * Resource lifecycle
 */
export interface ResourceLifecycle<R> {
  acquire: () => Effectful<R, { effects: [{ effect: 'Resource', operations: ['acquire'] }] }>;
  release: (resource: R) => Effectful<void, { effects: [{ effect: 'Resource', operations: ['release'] }] }>;
  use: <T>(resource: R, fn: (r: R) => T) => T;
}

/**
 * Effect scope - lexical scope for effects
 */
export interface EffectScope {
  id: string;
  parent?: EffectScope;
  handlers: Map<string, AlgebraicEffectHandler>;
  resources: Map<string, unknown>;
}

/**
 * Effect context - runtime context for effects
 */
export interface EffectContext {
  scope: EffectScope;
  stack: EffectFrame[];
  handlers: Map<string, AlgebraicEffectHandler[]>;
}

/**
 * Effect frame - stack frame for effect handling
 */
export interface EffectFrame {
  effect: string;
  operation: string;
  args: unknown[];
  continuation?: (value: unknown) => unknown;
}
