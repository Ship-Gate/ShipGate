/**
 * ISL Runtime Types
 * 
 * Core type definitions for the ISL runtime.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Value Types
// ─────────────────────────────────────────────────────────────────────────────

/** ISL primitive types */
export type IslPrimitive = 
  | string 
  | number 
  | boolean 
  | null 
  | undefined;

/** ISL value (any valid ISL data) */
export type IslValue = 
  | IslPrimitive
  | IslValue[]
  | { [key: string]: IslValue }
  | IslEntity
  | Date;

/** ISL entity instance */
export interface IslEntity {
  __type: string;
  __id: string;
  [key: string]: IslValue;
}

/** ISL behavior result */
export type IslResult<T = IslValue> = 
  | { success: true; value: T }
  | { success: false; error: IslError };

/** ISL error */
export interface IslError {
  code: string;
  message: string;
  details?: Record<string, IslValue>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Type Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Base type definition */
export interface TypeDef {
  name: string;
  kind: 'primitive' | 'entity' | 'enum' | 'type' | 'list' | 'map' | 'optional';
}

/** Primitive type definition */
export interface PrimitiveTypeDef extends TypeDef {
  kind: 'primitive';
  baseType: 'String' | 'Int' | 'Float' | 'Boolean' | 'UUID' | 'Timestamp' | 'Duration' | 'Date' | 'Time' | 'Email' | 'URL' | 'JSON' | 'Any' | 'Void';
  constraints?: TypeConstraints;
}

/** Type constraints */
export interface TypeConstraints {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  precision?: number;
  enum?: string[];
}

/** Entity type definition */
export interface EntityTypeDef extends TypeDef {
  kind: 'entity';
  fields: FieldDef[];
  invariants: InvariantDef[];
  lifecycle?: LifecycleDef;
}

/** Field definition */
export interface FieldDef {
  name: string;
  type: TypeRef;
  modifiers: FieldModifier[];
  defaultValue?: IslValue;
}

/** Field modifiers */
export type FieldModifier = 'immutable' | 'unique' | 'required' | 'indexed';

/** Type reference */
export interface TypeRef {
  name: string;
  typeArgs?: TypeRef[];
  optional?: boolean;
}

/** Enum type definition */
export interface EnumTypeDef extends TypeDef {
  kind: 'enum';
  values: string[];
}

/** List type definition */
export interface ListTypeDef extends TypeDef {
  kind: 'list';
  elementType: TypeRef;
  constraints?: { minLength?: number; maxLength?: number };
}

/** Map type definition */
export interface MapTypeDef extends TypeDef {
  kind: 'map';
  keyType: TypeRef;
  valueType: TypeRef;
}

/** Optional type definition */
export interface OptionalTypeDef extends TypeDef {
  kind: 'optional';
  innerType: TypeRef;
}

// ─────────────────────────────────────────────────────────────────────────────
// Behavior Definitions
// ─────────────────────────────────────────────────────────────────────────────

/** Behavior definition */
export interface BehaviorDef {
  name: string;
  description?: string;
  input: FieldDef[];
  output: OutputDef;
  preconditions: ConditionDef[];
  postconditions: ConditionDef[];
  temporal?: TemporalDef;
}

/** Output definition */
export interface OutputDef {
  success: TypeRef;
  errors: ErrorDef[];
}

/** Error definition */
export interface ErrorDef {
  code: string;
  message?: string;
  when?: string;
}

/** Condition definition */
export interface ConditionDef {
  expression: string;
  description?: string;
}

/** Temporal constraints */
export interface TemporalDef {
  responseTime?: { value: number; unit: 'ms' | 's'; percentile: number };
  eventually?: { timeout: number; unit: 'ms' | 's'; event: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariants and Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

/** Invariant definition */
export interface InvariantDef {
  expression: string;
  description?: string;
}

/** Lifecycle definition */
export interface LifecycleDef {
  states: string[];
  transitions: TransitionDef[];
}

/** State transition */
export interface TransitionDef {
  from: string;
  to: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Definition
// ─────────────────────────────────────────────────────────────────────────────

/** Complete domain definition */
export interface DomainDef {
  name: string;
  version: string;
  types: Map<string, TypeDef>;
  entities: Map<string, EntityTypeDef>;
  enums: Map<string, EnumTypeDef>;
  behaviors: Map<string, BehaviorDef>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Context
// ─────────────────────────────────────────────────────────────────────────────

/** Execution context */
export interface ExecutionContext {
  /** Current user/actor */
  actor?: string;
  /** Request ID for tracing */
  requestId: string;
  /** Timestamp of execution start */
  startTime: Date;
  /** Custom metadata */
  metadata: Record<string, IslValue>;
  /** Parent context (for nested calls) */
  parent?: ExecutionContext;
}

/** Entity store interface */
export interface EntityStore {
  get<T extends IslEntity>(type: string, id: string): Promise<T | null>;
  save<T extends IslEntity>(entity: T): Promise<void>;
  delete(type: string, id: string): Promise<void>;
  query<T extends IslEntity>(type: string, filter: QueryFilter): Promise<T[]>;
  count(type: string, filter?: QueryFilter): Promise<number>;
  exists(type: string, id: string): Promise<boolean>;
}

/** Query filter */
export interface QueryFilter {
  where?: Record<string, IslValue | QueryOperator>;
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

/** Query operators */
export interface QueryOperator {
  $eq?: IslValue;
  $ne?: IslValue;
  $gt?: number | Date;
  $gte?: number | Date;
  $lt?: number | Date;
  $lte?: number | Date;
  $in?: IslValue[];
  $nin?: IslValue[];
  $contains?: string;
  $startsWith?: string;
  $endsWith?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Types
// ─────────────────────────────────────────────────────────────────────────────

/** Runtime event types */
export type RuntimeEventType =
  | 'behavior:start'
  | 'behavior:success'
  | 'behavior:error'
  | 'entity:created'
  | 'entity:updated'
  | 'entity:deleted'
  | 'precondition:check'
  | 'postcondition:check'
  | 'invariant:check';

/** Runtime event */
export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: Date;
  context: ExecutionContext;
  data: Record<string, IslValue>;
}

/** Event handler */
export type EventHandler = (event: RuntimeEvent) => void | Promise<void>;
