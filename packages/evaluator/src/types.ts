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
  | unknown[]
  | Map<string, unknown>
  | Record<string, unknown>
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
  types?: TypeDef[];
}

export interface EntityDef {
  name: string;
  fields?: FieldDef[] | unknown[];
}

export interface TypeDef {
  name: string;
  definition?: unknown;
}

export interface FieldDef {
  name: string;
  type?: unknown;
  optional?: boolean;
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
// ERRORS - Using unified @isl-lang/errors codes
// ============================================================================

// Import unified error codes
// Note: These are imported at runtime from @isl-lang/errors
// E0400 = Division by zero
// E0401 = Null reference
// E0402 = Index out of bounds
// E0403 = Undefined property
// E0404 = Invalid operation
// E0408 = Type coercion failed

/**
 * Unified error codes for evaluator
 */
export const EvalErrorCodes = {
  DIVISION_BY_ZERO: 'E0400',
  NULL_REFERENCE: 'E0401',
  INDEX_OUT_OF_BOUNDS: 'E0402',
  UNDEFINED_PROPERTY: 'E0403',
  INVALID_OPERATION: 'E0404',
  STACK_OVERFLOW: 'E0405',
  TIMEOUT: 'E0406',
  MEMORY_LIMIT: 'E0407',
  TYPE_COERCION_FAILED: 'E0408',
  INVALID_REGEX: 'E0409',
  ENTITY_NOT_FOUND: 'E0410',
  IMMUTABLE_MODIFICATION: 'E0411',
  // Legacy codes (for backward compat)
  EVALUATION_ERROR: 'E0404',
  TYPE_ERROR: 'E0408',
  REFERENCE_ERROR: 'E0403',
  RUNTIME_ERROR: 'E0404',
} as const;

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
  public readonly notes: string[] = [];
  public readonly help: string[] = [];

  constructor(
    message: string,
    public readonly location: SourceLocation,
    public readonly expression?: unknown,
    public readonly code: string = EvalErrorCodes.EVALUATION_ERROR
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

  /**
   * Add a note to the error
   */
  withNote(note: string): this {
    this.notes.push(note);
    return this;
  }

  /**
   * Add a help suggestion to the error
   */
  withHelp(help: string): this {
    this.help.push(help);
    return this;
  }
}

/**
 * Error for type mismatches (E0408)
 */
export class TypeError extends EvaluationError {
  constructor(
    message: string,
    location: SourceLocation,
    public readonly expectedType: string,
    public readonly actualType: string,
    expression?: unknown
  ) {
    super(message, location, expression, EvalErrorCodes.TYPE_ERROR);
    this.name = 'TypeError';
    Object.setPrototypeOf(this, TypeError.prototype);
  }
}

/**
 * Error for undefined variables (E0403)
 */
export class ReferenceError extends EvaluationError {
  constructor(
    message: string,
    location: SourceLocation,
    public readonly identifier: string,
    expression?: unknown
  ) {
    super(message, location, expression, EvalErrorCodes.REFERENCE_ERROR);
    this.name = 'ReferenceError';
    Object.setPrototypeOf(this, ReferenceError.prototype);
  }
}

/**
 * Error for division by zero and similar runtime errors (E0400-E0411)
 */
export class RuntimeError extends EvaluationError {
  constructor(
    message: string,
    location: SourceLocation,
    expression?: unknown,
    code: string = EvalErrorCodes.RUNTIME_ERROR
  ) {
    super(message, location, expression, code);
    this.name = 'RuntimeError';
    Object.setPrototypeOf(this, RuntimeError.prototype);
  }

  /**
   * Create a division by zero error
   */
  static divisionByZero(location: SourceLocation, expression?: unknown): RuntimeError {
    return new RuntimeError(
      'Division by zero',
      location,
      expression,
      EvalErrorCodes.DIVISION_BY_ZERO
    ).withHelp('Add a precondition to ensure the divisor is non-zero');
  }

  /**
   * Create a null reference error
   */
  static nullReference(property: string, location: SourceLocation, expression?: unknown): RuntimeError {
    return new RuntimeError(
      `Cannot read property '${property}' of null`,
      location,
      expression,
      EvalErrorCodes.NULL_REFERENCE
    ).withHelp('Check for null before accessing properties, or use optional chaining (?.)');
  }

  /**
   * Create an index out of bounds error
   */
  static indexOutOfBounds(index: number, length: number, location: SourceLocation, expression?: unknown): RuntimeError {
    return new RuntimeError(
      `Index ${index} is out of bounds for array of length ${length}`,
      location,
      expression,
      EvalErrorCodes.INDEX_OUT_OF_BOUNDS
    ).withHelp('Ensure the index is within the valid range [0, length)');
  }

  /**
   * Create an entity not found error
   */
  static entityNotFound(entityName: string, id: string, location: SourceLocation): RuntimeError {
    return new RuntimeError(
      `Entity '${entityName}' with id '${id}' not found`,
      location,
      undefined,
      EvalErrorCodes.ENTITY_NOT_FOUND
    ).withHelp('Check that the entity exists before accessing it, or use exists() first');
  }
}

// ============================================================================
// DIAGNOSTIC CODES
// ============================================================================

/**
 * Semantic diagnostic codes for evaluator failures.
 * Every unknown/error path must produce one of these codes.
 */
export enum EvalDiagnosticCode {
  /** Member access on null or undefined value */
  EVAL_NULL_DEREF = 'EVAL_NULL_DEREF',
  /** Property does not exist on target object */
  EVAL_UNDEFINED_MEMBER = 'EVAL_UNDEFINED_MEMBER',
  /** Undefined variable or identifier */
  EVAL_UNDEFINED_VAR = 'EVAL_UNDEFINED_VAR',
  /** old() called without a previous state snapshot */
  EVAL_MISSING_OLD_STATE = 'EVAL_MISSING_OLD_STATE',
  /** Nested path resolution failed inside old() */
  EVAL_OLD_NESTED_FAIL = 'EVAL_OLD_NESTED_FAIL',
  /** Type mismatch in operation */
  EVAL_TYPE_MISMATCH = 'EVAL_TYPE_MISMATCH',
  /** Array/string index out of bounds */
  EVAL_OOB_INDEX = 'EVAL_OOB_INDEX',
  /** Unknown function or method call */
  EVAL_UNKNOWN_FUNCTION = 'EVAL_UNKNOWN_FUNCTION',
  /** Unsupported expression kind */
  EVAL_UNSUPPORTED_EXPR = 'EVAL_UNSUPPORTED_EXPR',
  /** Optional chaining applied to non-object value */
  EVAL_OPTIONAL_CHAIN_NON_OBJECT = 'EVAL_OPTIONAL_CHAIN_NON_OBJECT',
}

/**
 * Structured diagnostic payload attached to every evaluator failure.
 */
export interface DiagnosticPayload {
  /** Diagnostic code identifying the failure class */
  code: EvalDiagnosticCode;
  /** Human-readable message */
  message: string;
  /** Source span where the error originated */
  span: SourceLocation;
  /** String representation of the failing sub-expression */
  subExpression: string;
  /** Optional upstream cause (e.g. the inner error for old() wrapping) */
  cause?: DiagnosticPayload;
}

/**
 * Structured diagnostic error thrown by the evaluator.
 * Carries a full DiagnosticPayload so callers can inspect
 * the code, span, and sub-expression without parsing strings.
 */
export class DiagnosticError extends EvaluationError {
  public readonly diagnostic: DiagnosticPayload;

  constructor(payload: DiagnosticPayload, expression?: unknown) {
    super(payload.message, payload.span, expression, payload.code);
    this.name = 'DiagnosticError';
    this.diagnostic = payload;
    Object.setPrototypeOf(this, DiagnosticError.prototype);
  }

  /**
   * Wrap an existing DiagnosticError as the cause of a higher-level diagnostic.
   */
  static wrap(
    outerCode: EvalDiagnosticCode,
    outerMessage: string,
    outerSpan: SourceLocation,
    outerSubExpr: string,
    innerError: DiagnosticError,
    expression?: unknown,
  ): DiagnosticError {
    return new DiagnosticError(
      {
        code: outerCode,
        message: outerMessage,
        span: outerSpan,
        subExpression: outerSubExpr,
        cause: innerError.diagnostic,
      },
      expression,
    );
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
