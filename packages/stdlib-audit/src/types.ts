// ============================================================================
// ISL Standard Library - Audit Types
// @stdlib/audit/types
// ============================================================================

// ============================================================================
// RESULT TYPE (stdlib-core pattern)
// ============================================================================

export type Result<T, E = AuditError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// ============================================================================
// BRANDED TYPES
// ============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type AuditEntryId = Brand<string, 'AuditEntryId'>;
export type ActorId = Brand<string, 'ActorId'>;
export type ResourceId = Brand<string, 'ResourceId'>;

// ============================================================================
// ENUMS
// ============================================================================

export enum EventCategory {
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  ADMIN_ACTION = 'ADMIN_ACTION',
  SYSTEM_EVENT = 'SYSTEM_EVENT',
  SECURITY_EVENT = 'SECURITY_EVENT',
}

export enum EventOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  UNKNOWN = 'UNKNOWN',
}

export enum ActorType {
  USER = 'USER',
  SERVICE = 'SERVICE',
  SYSTEM = 'SYSTEM',
  ANONYMOUS = 'ANONYMOUS',
}

// ============================================================================
// CORE INTERFACES
// ============================================================================

export interface Actor {
  id: ActorId;
  type: ActorType;
  name?: string;
  email?: string;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  roles?: string[];
  organization_id?: string;
}

export interface Resource {
  type: string;
  id: ResourceId;
  name?: string;
  owner_id?: string;
  parent_type?: string;
  parent_id?: string;
}

export interface Source {
  service: string;
  version?: string;
  environment?: string;
  instance_id?: string;
  request_id?: string;
  host?: string;
  port?: number;
}

export interface Change {
  field: string;
  old_value?: unknown;
  new_value?: unknown;
  path?: string;
}

// ============================================================================
// AUDIT ENTRY (immutable once recorded)
// ============================================================================

export interface AuditEntry {
  readonly id: AuditEntryId;
  readonly action: string;
  readonly category: EventCategory;
  readonly outcome: EventOutcome;
  readonly description?: string;
  readonly actor: Readonly<Actor>;
  readonly resource?: Readonly<Resource>;
  readonly source: Readonly<Source>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
  readonly changes?: readonly Change[];
  readonly error_code?: string;
  readonly error_message?: string;
  readonly timestamp: Date;
  readonly duration_ms?: number;
  readonly retention_until?: Date;
  readonly compliance_flags?: readonly string[];
  readonly hash?: string;
  readonly previous_hash?: string;
}

// ============================================================================
// RECORD INPUT
// ============================================================================

export interface RecordInput {
  action: string;
  category: EventCategory;
  outcome: EventOutcome;
  actor: { id: string; type: ActorType } & Partial<Omit<Actor, 'id' | 'type'>>;
  source: Source;
  description?: string;
  resource?: { type: string; id: string } & Partial<Omit<Resource, 'type' | 'id'>>;
  metadata?: Record<string, unknown>;
  tags?: string[];
  changes?: Change[];
  error_code?: string;
  error_message?: string;
  duration_ms?: number;
  timestamp?: Date;
  idempotency_key?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface AuditError {
  code: string;
  message: string;
  retriable?: boolean;
}

export interface RecordError extends AuditError {
  code:
    | 'INVALID_INPUT'
    | 'INVALID_TIMESTAMP'
    | 'DUPLICATE_ENTRY'
    | 'STORAGE_ERROR'
    | 'RATE_LIMITED';
  field?: string;
}

export interface QueryError extends AuditError {
  code:
    | 'INVALID_QUERY'
    | 'INVALID_DATE_RANGE'
    | 'QUERY_TIMEOUT';
}

export interface ComplianceError extends AuditError {
  code:
    | 'RULE_EVALUATION_FAILED'
    | 'INVALID_RULE'
    | 'REPORT_GENERATION_FAILED';
}

export interface RetentionError extends AuditError {
  code:
    | 'PURGE_FAILED'
    | 'INVALID_POLICY'
    | 'POLICY_CONFLICT';
}

// ============================================================================
// STORE INTERFACE
// ============================================================================

export interface AuditStore {
  insert(entry: AuditEntry): Promise<void>;
  insertBatch(entries: AuditEntry[]): Promise<void>;
  findById(id: AuditEntryId): Promise<AuditEntry | null>;
  query(filters: StoreQueryFilters): AsyncIterable<AuditEntry>;
  count(filters: StoreQueryFilters): Promise<number>;
  deleteOlderThan(date: Date, category?: EventCategory): Promise<number>;
  healthCheck(): Promise<boolean>;
}

export interface StoreQueryFilters {
  actor_id?: string;
  actor_type?: ActorType;
  action?: string;
  action_prefix?: string;
  resource_type?: string;
  resource_id?: string;
  category?: EventCategory;
  categories?: EventCategory[];
  outcome?: EventOutcome;
  since?: Date;
  until?: Date;
  service?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}
