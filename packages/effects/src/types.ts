// ============================================================================
// ISL Effect System - Type Definitions
// Algebraic effects for tracking and controlling side effects
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
 * Effect - represents a single effect
 */
export interface Effect {
  kind: EffectKind;
  name: string;
  description?: string;
  operations: EffectOperation[];
  handlers?: EffectHandler[];
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
 * Effect handler - handles effect operations
 */
export interface EffectHandler {
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
 * Effect constraint - ISL syntax for effect bounds
 */
export interface EffectConstraint {
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
  handlers: Map<string, EffectHandler>;
  resources: Map<string, unknown>;
}

/**
 * Effect context - runtime context for effects
 */
export interface EffectContext {
  scope: EffectScope;
  stack: EffectFrame[];
  handlers: Map<string, EffectHandler[]>;
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
