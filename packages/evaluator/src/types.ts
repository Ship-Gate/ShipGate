// ============================================================================
// ISL Expression Evaluator - Type Definitions
// ============================================================================

/**
 * Source location information for error reporting
 */
export interface SourceLocation {
  file: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

/**
 * Base interface for AST nodes (re-exported for standalone use)
 */
export interface ASTNode {
  kind: string;
  location: SourceLocation;
}

// ============================================================================
// RUNTIME VALUES
// ============================================================================

/**
 * All possible runtime values in ISL
 */
export type Value =
  | null
  | undefined
  | boolean
  | number
  | string
  | Date
  | RegExp
  | Value[]
  | Map<string, Value>
  | Record<string, Value>
  | EntityInstance
  | LambdaValue;

/**
 * Represents a lambda/function value
 */
export interface LambdaValue {
  __type__: 'lambda';
  params: string[];
  body: unknown; // AST.Expression
  closure: Environment;
}

/**
 * Represents an entity instance
 */
export interface EntityInstance {
  __entity__: string;
  __id__: string;
  [key: string]: unknown;
}

// ============================================================================
// ENVIRONMENT & SCOPE
// ============================================================================

/**
 * Variable binding in the environment
 */
export interface Binding {
  name: string;
  value: Value;
  mutable: boolean;
}

/**
 * Environment interface for scope management
 */
export interface Environment {
  /** Get a variable's value */
  get(name: string): Value;
  
  /** Check if a variable exists */
  has(name: string): boolean;
  
  /** Set a variable's value */
  set(name: string, value: Value): void;
  
  /** Define a new variable */
  define(name: string, value: Value, mutable?: boolean): void;
  
  /** Create a child scope */
  child(): Environment;
  
  /** Get all bindings */
  bindings(): Map<string, Binding>;
}

// ============================================================================
// ENTITY STORE
// ============================================================================

/**
 * Entity store for managing entity instances
 */
export interface EntityStore {
  /** Get all instances of an entity type */
  getAll(entityName: string): EntityInstance[];
  
  /** Check if an entity with given criteria exists */
  exists(entityName: string, criteria?: Record<string, unknown>): boolean;
  
  /** Lookup single entity by criteria */
  lookup(entityName: string, criteria: Record<string, unknown>): EntityInstance | undefined;
  
  /** Count entities matching criteria */
  count(entityName: string, criteria?: Record<string, unknown>): number;
  
  /** Create a new entity instance */
  create(entityName: string, data: Record<string, unknown>): EntityInstance;
  
  /** Update an entity instance */
  update(entityName: string, id: string, data: Record<string, unknown>): void;
  
  /** Delete an entity instance */
  delete(entityName: string, id: string): void;
  
  /** Take a snapshot of current state */
  snapshot(): EntityStoreSnapshot;
  
  /** Restore from a snapshot */
  restore(snapshot: EntityStoreSnapshot): void;
}

/**
 * Snapshot of entity store state (for old() expressions)
 */
export interface EntityStoreSnapshot {
  entities: Map<string, Map<string, EntityInstance>>;
  timestamp: number;
}

// ============================================================================
// EVALUATION CONTEXT
// ============================================================================

/**
 * Domain definition (simplified for evaluator needs)
 */
export interface DomainDef {
  name: string;
  entities: EntityDef[];
  types: TypeDef[];
}

export interface EntityDef {
  name: string;
  fields: FieldDef[];
}

export interface TypeDef {
  name: string;
  definition: unknown;
}

export interface FieldDef {
  name: string;
  type: unknown;
  optional: boolean;
}

/**
 * Context for expression evaluation
 */
export interface EvaluationContext {
  /** Current input values */
  input: Record<string, unknown>;
  
  /** Result of behavior execution (for postconditions) */
  result?: unknown;
  
  /** Error if behavior failed */
  error?: EvaluationErrorInfo;
  
  /** Entity store for lookups */
  store: EntityStore;
  
  /** Snapshot of state before execution (for old() expressions) */
  oldState?: EntityStoreSnapshot;
  
  /** Domain definition for type information */
  domain?: DomainDef;
  
  /** Current timestamp for now() */
  now: Date;
  
  /** Variables in scope */
  variables: Map<string, unknown>;
}

// ============================================================================
// ERRORS
// ============================================================================

/**
 * Error information during evaluation
 */
export interface EvaluationErrorInfo {
  code: string;
  message: string;
  retriable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Structured evaluation error with source location
 */
export class EvaluationError extends Error {
  constructor(
    message: string,
    public readonly location: SourceLocation,
    public readonly expression?: unknown,
    public readonly code: string = 'EVALUATION_ERROR'
  ) {
    super(message);
    this.name = 'EvaluationError';
    Object.setPrototypeOf(this, EvaluationError.prototype);
  }

  /**
   * Get a formatted error message with location
   */
  formatMessage(): string {
    return `${this.code}: ${this.message} at ${this.location.file}:${this.location.line}:${this.location.column}`;
  }
}

/**
 * Error for type mismatches
 */
export class TypeError extends EvaluationError {
  constructor(
    message: string,
    location: SourceLocation,
    public readonly expectedType: string,
    public readonly actualType: string,
    expression?: unknown
  ) {
    super(message, location, expression, 'TYPE_ERROR');
    this.name = 'TypeError';
    Object.setPrototypeOf(this, TypeError.prototype);
  }
}

/**
 * Error for undefined variables
 */
export class ReferenceError extends EvaluationError {
  constructor(
    message: string,
    location: SourceLocation,
    public readonly identifier: string,
    expression?: unknown
  ) {
    super(message, location, expression, 'REFERENCE_ERROR');
    this.name = 'ReferenceError';
    Object.setPrototypeOf(this, ReferenceError.prototype);
  }
}

/**
 * Error for division by zero and similar runtime errors
 */
export class RuntimeError extends EvaluationError {
  constructor(
    message: string,
    location: SourceLocation,
    expression?: unknown
  ) {
    super(message, location, expression, 'RUNTIME_ERROR');
    this.name = 'RuntimeError';
    Object.setPrototypeOf(this, RuntimeError.prototype);
  }
}

// ============================================================================
// VERIFICATION
// ============================================================================

/**
 * Type of verification check
 */
export type CheckType = 'precondition' | 'postcondition' | 'invariant';

/**
 * Result of a single verification check
 */
export interface CheckResult {
  type: CheckType;
  name: string;
  expression: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  error?: string;
  location?: SourceLocation;
  duration: number;
}

/**
 * A verification failure
 */
export interface VerificationFailure {
  type: CheckType;
  expression: string;
  message: string;
  expected?: unknown;
  actual?: unknown;
  location: SourceLocation;
}

/**
 * Result of spec verification
 */
export interface VerificationResult {
  passed: boolean;
  failures: VerificationFailure[];
  preconditions: CheckResult[];
  postconditions: CheckResult[];
  invariants: CheckResult[];
  duration: number;
}

// ============================================================================
// BUILTIN FUNCTIONS
// ============================================================================

/**
 * Builtin function signature
 */
export type BuiltinFn = (
  args: Value[],
  context: EvaluationContext,
  location: SourceLocation
) => Value;

/**
 * Registry of builtin functions
 */
export interface BuiltinRegistry {
  get(name: string): BuiltinFn | undefined;
  has(name: string): boolean;
  register(name: string, fn: BuiltinFn): void;
  list(): string[];
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if a value is an entity instance
 */
export function isEntityInstance(value: unknown): value is EntityInstance {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__entity__' in value &&
    '__id__' in value
  );
}

/**
 * Check if a value is a lambda
 */
export function isLambdaValue(value: unknown): value is LambdaValue {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__type__' in value &&
    (value as LambdaValue).__type__ === 'lambda'
  );
}

/**
 * Get the runtime type of a value
 */
export function getValueType(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';
  if (value instanceof RegExp) return 'regex';
  if (value instanceof Map) return 'map';
  if (isEntityInstance(value)) return `entity:${value.__entity__}`;
  if (isLambdaValue(value)) return 'lambda';
  return typeof value;
}
