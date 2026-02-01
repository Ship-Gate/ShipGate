// ============================================================================
// ISL Standard Library - Audit Logger
// @stdlib/audit/logger
// ============================================================================

import { createHash, randomUUID } from 'crypto';
import type {
  AuditEvent,
  AuditEventId,
  ActorId,
  ResourceId,
  RecordInput,
  RecordResult,
  RecordBatchInput,
  QueryInput,
  QueryResult,
  AuditQueryResult,
  AuditFilters,
  StatsInput,
  AuditStats,
  ExportInput,
  ExportResultType,
  AuditStorage,
  EventCategory,
  EventOutcome,
  RetentionPolicy,
} from './types';

// ============================================================================
// LOGGER OPTIONS
// ============================================================================

export interface AuditLoggerOptions {
  storage: AuditStorage;
  
  // Source identification
  service: string;
  version?: string;
  environment?: string;
  instance_id?: string;
  
  // Features
  enableHashing?: boolean;
  enableChaining?: boolean;
  
  // Retention policies
  retentionPolicies?: RetentionPolicy[];
  
  // Rate limiting
  rateLimitPerSecond?: number;
  
  // Hooks
  beforeRecord?: (event: RecordInput) => RecordInput | Promise<RecordInput>;
  afterRecord?: (event: AuditEvent) => void | Promise<void>;
  
  // Error handling
  onError?: (error: Error, context: string) => void;
}

// ============================================================================
// AUDIT LOGGER CLASS
// ============================================================================

export class AuditLogger {
  private storage: AuditStorage;
  private options: Required<Omit<AuditLoggerOptions, 'beforeRecord' | 'afterRecord' | 'onError' | 'retentionPolicies'>> & 
    Pick<AuditLoggerOptions, 'beforeRecord' | 'afterRecord' | 'onError' | 'retentionPolicies'>;
  private lastEventHash: string | null = null;
  private requestCount = 0;
  private requestWindowStart = Date.now();

  constructor(options: AuditLoggerOptions) {
    this.storage = options.storage;
    this.options = {
      service: options.service,
      version: options.version ?? '1.0.0',
      environment: options.environment ?? 'production',
      instance_id: options.instance_id ?? randomUUID(),
      enableHashing: options.enableHashing ?? true,
      enableChaining: options.enableChaining ?? false,
      rateLimitPerSecond: options.rateLimitPerSecond ?? 10000,
      storage: options.storage,
      beforeRecord: options.beforeRecord,
      afterRecord: options.afterRecord,
      onError: options.onError,
      retentionPolicies: options.retentionPolicies,
    };
  }

  // ==========================================================================
  // RECORD METHODS
  // ==========================================================================

  async record(input: RecordInput): Promise<RecordResult> {
    try {
      // Rate limiting
      if (!this.checkRateLimit()) {
        return {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            retry_after_ms: 1000,
          },
        };
      }

      // Validate input
      const validationError = this.validateRecordInput(input);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Apply beforeRecord hook
      let processedInput = input;
      if (this.options.beforeRecord) {
        processedInput = await this.options.beforeRecord(input);
      }

      // Create event
      const event = this.createEvent(processedInput);

      // Persist
      await this.storage.insert(event);

      // Update chain
      if (this.options.enableChaining && event.hash) {
        this.lastEventHash = event.hash;
      }

      // Apply afterRecord hook
      if (this.options.afterRecord) {
        await this.options.afterRecord(event);
      }

      return { success: true, event };
    } catch (error) {
      const err = error as Error;
      this.options.onError?.(err, 'record');
      return {
        success: false,
        error: {
          code: 'STORAGE_ERROR',
          message: err.message,
          retriable: true,
        },
      };
    }
  }

  async recordBatch(input: RecordBatchInput): Promise<{
    success: boolean;
    events?: AuditEvent[];
    errors?: Array<{ index: number; error: RecordResult['error'] }>;
  }> {
    const events: AuditEvent[] = [];
    const errors: Array<{ index: number; error: any }> = [];

    for (let i = 0; i < input.events.length; i++) {
      const eventInput = input.events[i];
      const validationError = this.validateRecordInput(eventInput);

      if (validationError) {
        if (input.all_or_nothing) {
          return {
            success: false,
            errors: [{ index: i, error: validationError }],
          };
        }
        errors.push({ index: i, error: validationError });
        continue;
      }

      events.push(this.createEvent(eventInput));
    }

    try {
      await this.storage.insertBatch(events);
      return { success: true, events };
    } catch (error) {
      const err = error as Error;
      this.options.onError?.(err, 'recordBatch');
      return {
        success: false,
        errors: [{ index: -1, error: { code: 'STORAGE_ERROR', message: err.message } }],
      };
    }
  }

  // ==========================================================================
  // QUERY METHODS
  // ==========================================================================

  async query(input: QueryInput): Promise<QueryResult> {
    try {
      // Validate date range
      if (input.filters?.timestamp_start && input.filters?.timestamp_end) {
        const daysDiff = Math.ceil(
          (input.filters.timestamp_end.getTime() - input.filters.timestamp_start.getTime()) / 
          (1000 * 60 * 60 * 24)
        );
        if (daysDiff > 365) {
          return {
            success: false,
            error: { code: 'INVALID_DATE_RANGE', max_range_days: 365 },
          };
        }
      }

      const data = await this.storage.query(input);
      return { success: true, data };
    } catch (error) {
      const err = error as Error;
      this.options.onError?.(err, 'query');
      return {
        success: false,
        error: { code: 'QUERY_TIMEOUT', retriable: true },
      };
    }
  }

  async getById(id: string): Promise<AuditEvent | null> {
    return this.storage.findById(id as AuditEventId);
  }

  async getStats(input: StatsInput): Promise<AuditStats> {
    return this.storage.getStats(input);
  }

  // ==========================================================================
  // CONVENIENCE METHODS
  // ==========================================================================

  async logAuthentication(
    action: 'login' | 'logout' | 'password_change' | 'mfa_enable' | 'mfa_disable',
    actor: RecordInput['actor'],
    outcome: EventOutcome,
    metadata?: Record<string, unknown>
  ): Promise<RecordResult> {
    return this.record({
      action: `auth.${action}`,
      category: EventCategory.AUTHENTICATION,
      outcome,
      actor,
      source: this.getSource(),
      metadata,
    });
  }

  async logAuthorization(
    action: string,
    actor: RecordInput['actor'],
    resource: RecordInput['resource'],
    outcome: EventOutcome,
    metadata?: Record<string, unknown>
  ): Promise<RecordResult> {
    return this.record({
      action: `authz.${action}`,
      category: EventCategory.AUTHORIZATION,
      outcome,
      actor,
      resource,
      source: this.getSource(),
      metadata,
    });
  }

  async logDataAccess(
    action: 'read' | 'list' | 'search' | 'export',
    actor: RecordInput['actor'],
    resource: RecordInput['resource'],
    outcome: EventOutcome,
    metadata?: Record<string, unknown>
  ): Promise<RecordResult> {
    return this.record({
      action: `data.${action}`,
      category: EventCategory.DATA_ACCESS,
      outcome,
      actor,
      resource,
      source: this.getSource(),
      metadata,
    });
  }

  async logDataModification(
    action: 'create' | 'update' | 'delete',
    actor: RecordInput['actor'],
    resource: RecordInput['resource'],
    outcome: EventOutcome,
    changes?: RecordInput['changes'],
    metadata?: Record<string, unknown>
  ): Promise<RecordResult> {
    return this.record({
      action: `data.${action}`,
      category: EventCategory.DATA_MODIFICATION,
      outcome,
      actor,
      resource,
      source: this.getSource(),
      changes,
      metadata,
    });
  }

  async logAdminAction(
    action: string,
    actor: RecordInput['actor'],
    outcome: EventOutcome,
    resource?: RecordInput['resource'],
    metadata?: Record<string, unknown>
  ): Promise<RecordResult> {
    return this.record({
      action: `admin.${action}`,
      category: EventCategory.ADMIN_ACTION,
      outcome,
      actor,
      resource,
      source: this.getSource(),
      metadata,
    });
  }

  async logSecurityEvent(
    action: string,
    actor: RecordInput['actor'],
    outcome: EventOutcome,
    metadata?: Record<string, unknown>
  ): Promise<RecordResult> {
    return this.record({
      action: `security.${action}`,
      category: EventCategory.SECURITY_EVENT,
      outcome,
      actor,
      source: this.getSource(),
      metadata,
    });
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  private createEvent(input: RecordInput): AuditEvent {
    const id = randomUUID() as AuditEventId;
    const timestamp = input.timestamp ?? new Date();

    const event: AuditEvent = {
      id,
      action: input.action,
      category: input.category,
      outcome: input.outcome,
      description: input.description,
      actor: {
        ...input.actor,
        id: input.actor.id as ActorId,
      },
      resource: input.resource ? {
        ...input.resource,
        id: input.resource.id as ResourceId,
      } : undefined,
      source: {
        ...input.source,
        service: input.source.service || this.options.service,
        version: input.source.version || this.options.version,
        environment: input.source.environment || this.options.environment,
        instance_id: input.source.instance_id || this.options.instance_id,
      },
      metadata: input.metadata,
      tags: input.tags,
      changes: input.changes,
      error_code: input.error_code,
      error_message: input.error_message,
      timestamp,
      duration_ms: input.duration_ms,
      retention_until: this.calculateRetentionDate(input.category, timestamp),
    };

    // Add hash for integrity
    if (this.options.enableHashing) {
      event.hash = this.hashEvent(event);
      if (this.options.enableChaining && this.lastEventHash) {
        event.previous_hash = this.lastEventHash;
      }
    }

    return event;
  }

  private validateRecordInput(input: RecordInput): RecordResult['error'] | null {
    // Validate action
    if (!input.action || input.action.length === 0) {
      return { code: 'INVALID_ACTOR', field: 'action', reason: 'Action is required' };
    }

    // Validate actor
    if (!input.actor?.id || input.actor.id.length === 0) {
      return { code: 'INVALID_ACTOR', field: 'actor.id', reason: 'Actor ID is required' };
    }

    // Validate source
    if (!input.source?.service || input.source.service.length === 0) {
      return { code: 'INVALID_ACTOR', field: 'source.service', reason: 'Source service is required' };
    }

    // Validate timestamp
    if (input.timestamp && input.timestamp > new Date()) {
      return { code: 'INVALID_TIMESTAMP' };
    }

    // Validate resource if provided
    if (input.resource) {
      if (!input.resource.id || input.resource.id.length === 0) {
        return { code: 'INVALID_RESOURCE', field: 'resource.id', reason: 'Resource ID is required' };
      }
      if (!input.resource.type || input.resource.type.length === 0) {
        return { code: 'INVALID_RESOURCE', field: 'resource.type', reason: 'Resource type is required' };
      }
    }

    return null;
  }

  private checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.requestWindowStart > 1000) {
      this.requestCount = 0;
      this.requestWindowStart = now;
    }
    
    this.requestCount++;
    return this.requestCount <= this.options.rateLimitPerSecond;
  }

  private calculateRetentionDate(category: EventCategory, timestamp: Date): Date | undefined {
    const policy = this.options.retentionPolicies?.find(p => p.category === category);
    if (policy) {
      const retention = new Date(timestamp);
      retention.setDate(retention.getDate() + policy.retention_days);
      return retention;
    }
    
    // Default retention based on compliance requirements
    const defaultDays = category === EventCategory.SECURITY_EVENT ? 365 : 90;
    const retention = new Date(timestamp);
    retention.setDate(retention.getDate() + defaultDays);
    return retention;
  }

  private hashEvent(event: AuditEvent): string {
    const content = JSON.stringify({
      id: event.id,
      action: event.action,
      category: event.category,
      outcome: event.outcome,
      actor: event.actor,
      resource: event.resource,
      timestamp: event.timestamp.toISOString(),
      previous_hash: event.previous_hash,
    });
    return createHash('sha256').update(content).digest('hex');
  }

  private getSource(): RecordInput['source'] {
    return {
      service: this.options.service,
      version: this.options.version,
      environment: this.options.environment,
      instance_id: this.options.instance_id,
    };
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async healthCheck(): Promise<boolean> {
    return this.storage.healthCheck();
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createAuditLogger(options: AuditLoggerOptions): AuditLogger {
  return new AuditLogger(options);
}
