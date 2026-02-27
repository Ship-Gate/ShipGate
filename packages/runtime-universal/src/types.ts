/**
 * Core type definitions for the ISL Universal Runtime
 */

/**
 * Execution context for a behavior
 */
export interface ExecutionContext {
  /** Unique execution ID */
  executionId: string;
  /** Domain being executed */
  domain: string;
  /** Behavior being executed */
  behavior: string;
  /** Actor performing the action */
  actor: Actor;
  /** Input parameters */
  input: Record<string, unknown>;
  /** Current state snapshot */
  state: StateSnapshot;
  /** Execution metadata */
  metadata: ExecutionMetadata;
  /** Parent context for nested executions */
  parent?: ExecutionContext;
  /** Trace/span ID for observability */
  traceId: string;
}

/**
 * Actor performing an action
 */
export interface Actor {
  id: string;
  type: 'user' | 'system' | 'service' | 'scheduler';
  roles: string[];
  permissions: string[];
  metadata?: Record<string, unknown>;
}

/**
 * State snapshot at a point in time
 */
export interface StateSnapshot {
  version: number;
  timestamp: number;
  entities: Map<string, EntityState>;
  checksum: string;
}

/**
 * Entity state
 */
export interface EntityState {
  id: string;
  type: string;
  data: Record<string, unknown>;
  version: number;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  startTime: number;
  timeout?: number;
  retryCount: number;
  maxRetries: number;
  idempotencyKey?: string;
  correlationId?: string;
  causationId?: string;
  tags: Record<string, string>;
}

/**
 * Behavior definition from ISL
 */
export interface BehaviorDefinition {
  domain: string;
  name: string;
  description?: string;
  actor: string;
  input: ParameterDefinition[];
  output: ParameterDefinition[];
  preconditions: ConditionDefinition[];
  postconditions: ConditionDefinition[];
  invariants: ConditionDefinition[];
  effects: EffectDefinition[];
  timeout?: number;
  retryPolicy?: RetryPolicy;
  idempotent: boolean;
}

/**
 * Parameter definition
 */
export interface ParameterDefinition {
  name: string;
  type: TypeDefinition;
  required: boolean;
  default?: unknown;
  description?: string;
  constraints?: ConstraintDefinition[];
}

/**
 * Type definition
 */
export interface TypeDefinition {
  kind: 'primitive' | 'entity' | 'enum' | 'array' | 'map' | 'union' | 'optional';
  name: string;
  elementType?: TypeDefinition;
  keyType?: TypeDefinition;
  valueType?: TypeDefinition;
  variants?: TypeDefinition[];
  properties?: ParameterDefinition[];
}

/**
 * Condition definition (pre/post/invariant)
 */
export interface ConditionDefinition {
  name: string;
  expression: string;
  message?: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Effect definition
 */
export interface EffectDefinition {
  type: 'create' | 'update' | 'delete' | 'emit' | 'call';
  target: string;
  expression?: string;
  condition?: string;
}

/**
 * Constraint definition
 */
export interface ConstraintDefinition {
  type: 'min' | 'max' | 'pattern' | 'length' | 'range' | 'enum' | 'custom';
  value: unknown;
  message?: string;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
}

/**
 * Execution result
 */
export interface ExecutionResult<T = unknown> {
  success: boolean;
  executionId: string;
  output?: T;
  error?: ExecutionError;
  effects: AppliedEffect[];
  duration: number;
  verificationResult: VerificationResult;
  stateChanges: StateChange[];
}

/**
 * Execution error
 */
export interface ExecutionError {
  code: string;
  message: string;
  type: 'precondition' | 'postcondition' | 'invariant' | 'runtime' | 'timeout' | 'permission';
  details?: Record<string, unknown>;
  stack?: string;
  retryable: boolean;
}

/**
 * Applied effect during execution
 */
export interface AppliedEffect {
  type: EffectDefinition['type'];
  target: string;
  timestamp: number;
  data?: unknown;
  success: boolean;
  error?: string;
}

/**
 * Verification result
 */
export interface VerificationResult {
  verdict: 'pass' | 'fail' | 'error';
  score: number;
  preconditions: ConditionResult[];
  postconditions: ConditionResult[];
  invariants: ConditionResult[];
}

/**
 * Condition evaluation result
 */
export interface ConditionResult {
  name: string;
  passed: boolean;
  expression: string;
  actualValue?: unknown;
  expectedValue?: unknown;
  message?: string;
}

/**
 * State change record
 */
export interface StateChange {
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Runtime configuration
 */
export interface RuntimeConfig {
  /** Enable sandboxed execution */
  sandbox: boolean;
  /** Execution timeout in milliseconds */
  defaultTimeout: number;
  /** Maximum execution depth for nested behaviors */
  maxExecutionDepth: number;
  /** Enable state persistence */
  persistState: boolean;
  /** Enable execution logging */
  enableLogging: boolean;
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Enable distributed execution */
  distributed: boolean;
  /** Verification mode */
  verificationMode: 'strict' | 'lenient' | 'none';
  /** Hot reload enabled */
  hotReload: boolean;
}

/**
 * Runtime event
 */
export interface RuntimeEvent {
  type: RuntimeEventType;
  executionId: string;
  timestamp: number;
  data: Record<string, unknown>;
}

/**
 * Runtime event types
 */
export type RuntimeEventType =
  | 'execution:started'
  | 'execution:completed'
  | 'execution:failed'
  | 'condition:evaluated'
  | 'effect:applied'
  | 'state:changed'
  | 'behavior:loaded'
  | 'behavior:reloaded'
  | 'error:occurred';

/**
 * Plugin interface for extending runtime
 */
export interface RuntimePlugin {
  name: string;
  version: string;
  initialize(runtime: RuntimeAPI): Promise<void>;
  destroy(): Promise<void>;
}

/**
 * Runtime API exposed to plugins
 */
export interface RuntimeAPI {
  execute<T>(domain: string, behavior: string, input: Record<string, unknown>, actor: Actor): Promise<ExecutionResult<T>>;
  getState(): StateSnapshot;
  setState(state: StateSnapshot): void;
  subscribe(event: RuntimeEventType, handler: (event: RuntimeEvent) => void): () => void;
  registerEffect(type: string, handler: EffectHandler): void;
  registerValidator(type: string, validator: Validator): void;
}

/**
 * Effect handler function
 */
export type EffectHandler = (
  effect: EffectDefinition,
  context: ExecutionContext
) => Promise<AppliedEffect>;

/**
 * Validator function
 */
export type Validator = (
  value: unknown,
  constraint: ConstraintDefinition
) => { valid: boolean; message?: string };
