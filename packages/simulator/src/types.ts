/**
 * Simulator Types
 */

// ─────────────────────────────────────────────────────────────────────────────
// Core Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulatorOptions {
  /** Parsed ISL domain */
  domain: Domain;
  /** Initial state for entities */
  initialState?: Record<string, unknown[]>;
  /** Custom behavior implementations */
  implementations?: Record<string, BehaviorImplementation>;
  /** Enable strict mode (fail on unimplemented behaviors) */
  strict?: boolean;
  /** Random seed for deterministic simulations */
  seed?: number;
  /** Enable event recording */
  recording?: boolean;
}

export interface Domain {
  name: string;
  version?: string;
  entities: EntityDefinition[];
  behaviors: BehaviorDefinition[];
  enums: EnumDefinition[];
  invariants: InvariantDefinition[];
}

export interface EntityDefinition {
  name: string;
  fields: FieldDefinition[];
  invariants?: string[];
  lifecycle?: LifecycleTransition[];
}

export interface FieldDefinition {
  name: string;
  type: string;
  modifiers: string[];
  defaultValue?: unknown;
}

export interface BehaviorDefinition {
  name: string;
  description?: string;
  inputs: FieldDefinition[];
  outputs: OutputDefinition;
  preconditions: string[];
  postconditions: PostconditionDefinition[];
  invariants: string[];
}

export interface OutputDefinition {
  successType: string;
  errors: ErrorDefinition[];
}

export interface ErrorDefinition {
  code: string;
  when: string;
  retriable?: boolean;
  retryAfter?: string;
}

export interface PostconditionDefinition {
  outcome: 'success' | 'error' | string;
  predicates: string[];
}

export interface InvariantDefinition {
  name: string;
  scope: 'global' | 'entity' | 'behavior';
  predicates: string[];
}

export interface EnumDefinition {
  name: string;
  values: string[];
}

export interface LifecycleTransition {
  from: string;
  to: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Execution Types
// ─────────────────────────────────────────────────────────────────────────────

export type BehaviorImplementation = (
  input: Record<string, unknown>,
  context: ExecutionContext
) => Promise<BehaviorResult>;

export interface ExecutionContext {
  /** Current state */
  state: SimulatorState;
  /** Get entity by type and id */
  getEntity: <T = unknown>(type: string, id: string) => T | null;
  /** Find entities by predicate */
  findEntities: <T = unknown>(type: string, predicate: (entity: T) => boolean) => T[];
  /** Create a new entity */
  createEntity: <T extends Record<string, unknown> = Record<string, unknown>>(type: string, data: T) => T & { id: string };
  /** Update an entity */
  updateEntity: <T extends Record<string, unknown> = Record<string, unknown>>(type: string, id: string, data: Partial<T>) => T;
  /** Delete an entity */
  deleteEntity: (type: string, id: string) => boolean;
  /** Generate UUID */
  generateId: () => string;
  /** Current timestamp */
  now: () => Date;
  /** Random number generator (seeded) */
  random: () => number;
}

export interface BehaviorResult {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    retriable?: boolean;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SimulatorState {
  /** Entity stores keyed by entity type */
  entities: Record<string, EntityStore>;
  /** Custom state */
  custom: Record<string, unknown>;
  /** State version for optimistic concurrency */
  version: number;
}

export interface EntityStore {
  /** All entities of this type */
  items: Record<string, EntityInstance>;
  /** Entity count */
  count: number;
}

export interface EntityInstance {
  id: string;
  data: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Types
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineEvent {
  /** Event ID */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Relative time from simulation start (ms) */
  relativeTime: number;
  /** Event type */
  type: 'behavior' | 'state_change' | 'invariant_check' | 'error';
  /** Behavior name (if type is 'behavior') */
  behavior?: string;
  /** Input data */
  input?: Record<string, unknown>;
  /** Output/result */
  output?: BehaviorResult;
  /** State snapshot before event */
  stateBefore?: SimulatorState;
  /** State snapshot after event */
  stateAfter?: SimulatorState;
  /** Duration in ms */
  durationMs?: number;
  /** Parent event ID (for nested events) */
  parentId?: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

export interface Timeline {
  /** All events */
  events: TimelineEvent[];
  /** Simulation start time */
  startTime: Date;
  /** Simulation end time */
  endTime?: Date;
  /** Total duration */
  durationMs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariant Check Types
// ─────────────────────────────────────────────────────────────────────────────

export interface InvariantCheckResult {
  valid: boolean;
  violations: InvariantViolation[];
  checked: number;
  passed: number;
  failed: number;
}

export interface InvariantViolation {
  invariant: string;
  scope: string;
  entity?: string;
  entityId?: string;
  message: string;
  predicate: string;
  context?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scenario Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Scenario {
  /** Scenario name */
  name: string;
  /** Description */
  description?: string;
  /** Steps to execute */
  steps: ScenarioStep[];
  /** Expected final state assertions */
  assertions?: ScenarioAssertion[];
  /** Tags for filtering */
  tags?: string[];
}

export interface ScenarioStep {
  /** Step name */
  name?: string;
  /** Behavior to execute */
  behavior: string;
  /** Input data */
  input: Record<string, unknown>;
  /** Expected result */
  expect?: {
    success?: boolean;
    errorCode?: string;
    data?: Record<string, unknown>;
  };
  /** Delay before execution (ms) */
  delay?: number;
}

export interface ScenarioAssertion {
  /** What to check */
  type: 'entity_exists' | 'entity_count' | 'state_value' | 'invariant';
  /** Entity type (for entity assertions) */
  entityType?: string;
  /** Expected value */
  expected: unknown;
  /** Path to value (for state_value) */
  path?: string;
}

export interface ScenarioResult {
  scenario: Scenario;
  success: boolean;
  steps: ScenarioStepResult[];
  assertions: ScenarioAssertionResult[];
  timeline: Timeline;
  durationMs: number;
  error?: string;
}

export interface ScenarioStepResult {
  step: ScenarioStep;
  success: boolean;
  result: BehaviorResult;
  durationMs: number;
  error?: string;
}

export interface ScenarioAssertionResult {
  assertion: ScenarioAssertion;
  passed: boolean;
  actual: unknown;
  message?: string;
}
