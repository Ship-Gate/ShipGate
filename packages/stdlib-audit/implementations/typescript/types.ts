// ============================================================================
// ISL Standard Library - Audit Log Types
// @stdlib/audit/types
// ============================================================================

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

export enum ExportFormat {
  CSV = 'CSV',
  JSON = 'JSON',
  NDJSON = 'NDJSON',
  PARQUET = 'PARQUET',
}

export enum SortDirection {
  ASC = 'ASC',
  DESC = 'DESC',
}

export enum TagMatch {
  ALL = 'ALL',
  ANY = 'ANY',
}

export enum TimeBucket {
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
}

export enum CompressionType {
  NONE = 'NONE',
  GZIP = 'GZIP',
  ZSTD = 'ZSTD',
}

export enum DeliveryMethod {
  DOWNLOAD = 'DOWNLOAD',
  EMAIL = 'EMAIL',
  S3 = 'S3',
  WEBHOOK = 'WEBHOOK',
}

export enum ExportJobStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

// ============================================================================
// BRANDED TYPES
// ============================================================================

declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type AuditEventId = Brand<string, 'AuditEventId'>;
export type ActorId = Brand<string, 'ActorId'>;
export type ResourceId = Brand<string, 'ResourceId'>;

// ============================================================================
// COMPLEX TYPES
// ============================================================================

export interface Actor {
  id: ActorId;
  type: ActorType;
  name?: string;
  email?: string; // PII
  ip_address?: string; // PII
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
  old_value?: unknown; // Sensitive
  new_value?: unknown; // Sensitive
  path?: string;
}

export interface Pagination {
  page: number;
  page_size: number;
}

export interface SortOrder {
  field: string;
  direction: SortDirection;
}

// ============================================================================
// MAIN ENTITY
// ============================================================================

export interface AuditEvent {
  id: AuditEventId;
  
  // What happened
  action: string;
  category: EventCategory;
  outcome: EventOutcome;
  description?: string;
  
  // Who did it
  actor: Actor;
  
  // What was affected
  resource?: Resource;
  
  // Context
  source: Source;
  metadata?: Record<string, unknown>;
  tags?: string[];
  
  // Changes
  changes?: Change[];
  
  // Error details
  error_code?: string;
  error_message?: string;
  
  // Timing
  timestamp: Date;
  duration_ms?: number;
  
  // Compliance
  retention_until?: Date;
  compliance_flags?: string[];
  
  // Immutability proof
  hash?: string;
  previous_hash?: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

export interface RecordInput {
  action: string;
  category: EventCategory;
  outcome: EventOutcome;
  actor: Omit<Actor, 'id'> & { id: string };
  source: Source;
  description?: string;
  resource?: Omit<Resource, 'id'> & { id: string };
  metadata?: Record<string, unknown>;
  tags?: string[];
  changes?: Change[];
  error_code?: string;
  error_message?: string;
  duration_ms?: number;
  timestamp?: Date;
  idempotency_key?: string;
}

export interface RecordBatchInput {
  events: RecordInput[];
  all_or_nothing?: boolean;
}

// ============================================================================
// QUERY TYPES
// ============================================================================

export interface AuditFilters {
  // Actor filters
  actor_id?: ActorId;
  actor_type?: ActorType;
  actor_email?: string; // PII
  
  // Resource filters
  resource_type?: string;
  resource_id?: ResourceId;
  
  // Event filters
  action?: string;
  action_prefix?: string;
  category?: EventCategory;
  categories?: EventCategory[];
  outcome?: EventOutcome;
  
  // Time filters
  timestamp_start?: Date;
  timestamp_end?: Date;
  
  // Source filters
  service?: string;
  environment?: string;
  request_id?: string;
  
  // Full-text search
  search?: string;
  
  // Tag filters
  tags?: string[];
  tags_match?: TagMatch;
}

export interface QueryInput {
  filters?: AuditFilters;
  pagination: Pagination;
  sort?: SortOrder;
  fields?: string[];
  include_changes?: boolean;
  include_metadata?: boolean;
}

export interface AuditQueryResult {
  events: AuditEvent[];
  total_count: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

// ============================================================================
// STATS TYPES
// ============================================================================

export interface StatsInput {
  filters?: AuditFilters;
  group_by?: string[];
  time_bucket?: TimeBucket;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  count: number;
  by_category?: Record<EventCategory, number>;
  by_outcome?: Record<EventOutcome, number>;
}

export interface AuditStats {
  total_events: number;
  by_category?: Record<EventCategory, number>;
  by_outcome?: Record<EventOutcome, number>;
  by_actor_type?: Record<ActorType, number>;
  by_service?: Record<string, number>;
  time_series?: TimeSeriesPoint[];
}

// ============================================================================
// EXPORT TYPES
// ============================================================================

export interface DeliveryOptions {
  method: DeliveryMethod;
  destination: string;
  notify_on_complete?: boolean;
}

export interface ExportInput {
  filters: AuditFilters;
  format: ExportFormat;
  include_pii: boolean;
  mask_pii?: boolean;
  compression?: CompressionType;
  max_events?: number;
  delivery?: DeliveryOptions;
}

export interface ExportResult {
  export_id: string;
  format: ExportFormat;
  event_count: number;
  file_size_bytes: number;
  download_url?: string;
  expires_at?: Date;
}

export interface ExportStatus {
  export_id: string;
  status: ExportJobStatus;
  progress_percent?: number;
  events_processed?: number;
  total_events?: number;
  started_at: Date;
  completed_at?: Date;
  error_message?: string;
  result?: ExportResult;
}

// ============================================================================
// RETENTION TYPES
// ============================================================================

export interface RetentionPolicy {
  category: EventCategory;
  retention_days: number;
  archive_after_days?: number;
  compliance_standard?: string;
}

// ============================================================================
// RESULT TYPES
// ============================================================================

export type RecordResult =
  | { success: true; event: AuditEvent }
  | { success: false; error: RecordError };

export type RecordError =
  | { code: 'INVALID_ACTOR'; field: string; reason: string }
  | { code: 'INVALID_RESOURCE'; field: string; reason: string }
  | { code: 'INVALID_TIMESTAMP' }
  | { code: 'DUPLICATE_EVENT'; existing_event: AuditEvent }
  | { code: 'STORAGE_ERROR'; message: string; retriable: true }
  | { code: 'RATE_LIMITED'; retry_after_ms: number };

export type QueryResult =
  | { success: true; data: AuditQueryResult }
  | { success: false; error: QueryError };

export type QueryError =
  | { code: 'INVALID_QUERY'; field: string; reason: string }
  | { code: 'INVALID_DATE_RANGE'; max_range_days: number }
  | { code: 'QUERY_TIMEOUT'; retriable: true }
  | { code: 'UNAUTHORIZED' };

export type ExportResultType =
  | { success: true; data: ExportResult }
  | { success: false; error: ExportError };

export type ExportError =
  | { code: 'TOO_MANY_EVENTS'; event_count: number; max_allowed: number }
  | { code: 'DATE_RANGE_TOO_WIDE'; max_days: number }
  | { code: 'EXPORT_IN_PROGRESS'; existing_export_id: string }
  | { code: 'STORAGE_ERROR'; message: string; retriable: true }
  | { code: 'DELIVERY_ERROR'; message: string; retriable: true };

// ============================================================================
// STORAGE INTERFACE
// ============================================================================

export interface AuditStorage {
  // Write operations
  insert(event: AuditEvent): Promise<void>;
  insertBatch(events: AuditEvent[]): Promise<void>;
  
  // Read operations
  findById(id: AuditEventId): Promise<AuditEvent | null>;
  query(input: QueryInput): Promise<AuditQueryResult>;
  search?(query: string, filters?: AuditFilters, pagination?: Pagination): Promise<AuditQueryResult>;
  
  // Stats
  getStats(input: StatsInput): Promise<AuditStats>;
  
  // Maintenance
  deleteOlderThan(date: Date): Promise<number>;
  
  // Health
  healthCheck(): Promise<boolean>;
}

// ============================================================================
// EXPORTER INTERFACE
// ============================================================================

export interface AuditExporter {
  format: ExportFormat;
  
  export(
    events: AsyncIterable<AuditEvent>,
    options: ExportOptions
  ): Promise<ExportOutput>;
  
  supportedCompression: CompressionType[];
}

export interface ExportOptions {
  include_pii: boolean;
  mask_pii: boolean;
  compression: CompressionType;
  fields?: string[];
}

export interface ExportOutput {
  data: Buffer | ReadableStream;
  size_bytes: number;
  content_type: string;
}
