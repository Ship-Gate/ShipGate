// ============================================================================
// ISL Standard Library - Audit Logger Tests
// @stdlib/audit/tests
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  AuditLogger, 
  createAuditLogger,
  type AuditLoggerOptions,
} from '../implementations/typescript/logger';
import {
  EventCategory,
  EventOutcome,
  ActorType,
  type AuditStorage,
  type AuditEvent,
  type RecordInput,
  type AuditEventId,
  type QueryInput,
  type AuditQueryResult,
  type StatsInput,
  type AuditStats,
} from '../implementations/typescript/types';

// ============================================================================
// MOCK STORAGE
// ============================================================================

function createMockStorage(): AuditStorage {
  const events = new Map<string, AuditEvent>();
  
  return {
    insert: vi.fn(async (event: AuditEvent) => {
      events.set(event.id, event);
    }),
    insertBatch: vi.fn(async (batch: AuditEvent[]) => {
      for (const event of batch) {
        events.set(event.id, event);
      }
    }),
    findById: vi.fn(async (id: AuditEventId) => {
      return events.get(id) ?? null;
    }),
    query: vi.fn(async (input: QueryInput): Promise<AuditQueryResult> => {
      const allEvents = Array.from(events.values());
      return {
        events: allEvents.slice(0, input.pagination.page_size),
        total_count: allEvents.length,
        page: input.pagination.page,
        page_size: input.pagination.page_size,
        has_more: false,
      };
    }),
    getStats: vi.fn(async (_input: StatsInput): Promise<AuditStats> => {
      return {
        total_events: events.size,
        by_category: {} as any,
        by_outcome: {} as any,
      };
    }),
    deleteOlderThan: vi.fn(async () => 0),
    healthCheck: vi.fn(async () => true),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('AuditLogger', () => {
  let storage: AuditStorage;
  let logger: AuditLogger;

  beforeEach(() => {
    storage = createMockStorage();
    logger = createAuditLogger({
      storage,
      service: 'test-service',
      version: '1.0.0',
      environment: 'test',
    });
  });

  describe('record', () => {
    it('should record a valid audit event', async () => {
      const input: RecordInput = {
        action: 'user.login',
        category: EventCategory.AUTHENTICATION,
        outcome: EventOutcome.SUCCESS,
        actor: {
          id: 'user-123',
          type: ActorType.USER,
          name: 'John Doe',
        },
        source: {
          service: 'auth-service',
        },
      };

      const result = await logger.record(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.action).toBe('user.login');
        expect(result.event.category).toBe(EventCategory.AUTHENTICATION);
        expect(result.event.outcome).toBe(EventOutcome.SUCCESS);
        expect(result.event.actor.id).toBe('user-123');
        expect(result.event.timestamp).toBeInstanceOf(Date);
        expect(result.event.hash).toBeDefined();
      }

      expect(storage.insert).toHaveBeenCalledTimes(1);
    });

    it('should reject invalid actor', async () => {
      const input: RecordInput = {
        action: 'user.login',
        category: EventCategory.AUTHENTICATION,
        outcome: EventOutcome.SUCCESS,
        actor: {
          id: '', // Invalid - empty
          type: ActorType.USER,
        },
        source: {
          service: 'auth-service',
        },
      };

      const result = await logger.record(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_ACTOR');
      }
    });

    it('should reject future timestamp', async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const input: RecordInput = {
        action: 'user.login',
        category: EventCategory.AUTHENTICATION,
        outcome: EventOutcome.SUCCESS,
        actor: {
          id: 'user-123',
          type: ActorType.USER,
        },
        source: {
          service: 'auth-service',
        },
        timestamp: futureDate,
      };

      const result = await logger.record(input);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_TIMESTAMP');
      }
    });

    it('should include resource when provided', async () => {
      const input: RecordInput = {
        action: 'document.read',
        category: EventCategory.DATA_ACCESS,
        outcome: EventOutcome.SUCCESS,
        actor: {
          id: 'user-123',
          type: ActorType.USER,
        },
        source: {
          service: 'doc-service',
        },
        resource: {
          type: 'document',
          id: 'doc-456',
          name: 'Secret Document',
        },
      };

      const result = await logger.record(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.resource).toBeDefined();
        expect(result.event.resource?.type).toBe('document');
        expect(result.event.resource?.id).toBe('doc-456');
      }
    });

    it('should include changes for modifications', async () => {
      const input: RecordInput = {
        action: 'user.update',
        category: EventCategory.DATA_MODIFICATION,
        outcome: EventOutcome.SUCCESS,
        actor: {
          id: 'admin-1',
          type: ActorType.USER,
        },
        source: {
          service: 'user-service',
        },
        resource: {
          type: 'user',
          id: 'user-123',
        },
        changes: [
          { field: 'email', old_value: 'old@example.com', new_value: 'new@example.com' },
          { field: 'name', old_value: 'John', new_value: 'Johnny' },
        ],
      };

      const result = await logger.record(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.changes).toHaveLength(2);
        expect(result.event.changes?.[0].field).toBe('email');
      }
    });
  });

  describe('convenience methods', () => {
    it('should log authentication events', async () => {
      const result = await logger.logAuthentication(
        'login',
        { id: 'user-123', type: ActorType.USER },
        EventOutcome.SUCCESS,
        { method: '2fa' }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.action).toBe('auth.login');
        expect(result.event.category).toBe(EventCategory.AUTHENTICATION);
        expect(result.event.metadata?.method).toBe('2fa');
      }
    });

    it('should log data access events', async () => {
      const result = await logger.logDataAccess(
        'read',
        { id: 'user-123', type: ActorType.USER },
        { type: 'customer', id: 'cust-456' },
        EventOutcome.SUCCESS
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.action).toBe('data.read');
        expect(result.event.category).toBe(EventCategory.DATA_ACCESS);
      }
    });

    it('should log data modification events', async () => {
      const result = await logger.logDataModification(
        'update',
        { id: 'user-123', type: ActorType.USER },
        { type: 'order', id: 'order-789' },
        EventOutcome.SUCCESS,
        [{ field: 'status', old_value: 'pending', new_value: 'completed' }]
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.action).toBe('data.update');
        expect(result.event.category).toBe(EventCategory.DATA_MODIFICATION);
        expect(result.event.changes).toHaveLength(1);
      }
    });

    it('should log security events', async () => {
      const result = await logger.logSecurityEvent(
        'suspicious_login',
        { id: 'user-123', type: ActorType.USER, ip_address: '1.2.3.4' },
        EventOutcome.FAILURE,
        { reason: 'multiple_failed_attempts' }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.action).toBe('security.suspicious_login');
        expect(result.event.category).toBe(EventCategory.SECURITY_EVENT);
      }
    });
  });

  describe('batch recording', () => {
    it('should record multiple events', async () => {
      const events: RecordInput[] = [
        {
          action: 'user.login',
          category: EventCategory.AUTHENTICATION,
          outcome: EventOutcome.SUCCESS,
          actor: { id: 'user-1', type: ActorType.USER },
          source: { service: 'auth' },
        },
        {
          action: 'user.login',
          category: EventCategory.AUTHENTICATION,
          outcome: EventOutcome.SUCCESS,
          actor: { id: 'user-2', type: ActorType.USER },
          source: { service: 'auth' },
        },
      ];

      const result = await logger.recordBatch({ events });

      expect(result.success).toBe(true);
      expect(result.events).toHaveLength(2);
      expect(storage.insertBatch).toHaveBeenCalledTimes(1);
    });

    it('should fail entire batch with all_or_nothing', async () => {
      const events: RecordInput[] = [
        {
          action: 'valid.action',
          category: EventCategory.AUTHENTICATION,
          outcome: EventOutcome.SUCCESS,
          actor: { id: 'user-1', type: ActorType.USER },
          source: { service: 'auth' },
        },
        {
          action: '', // Invalid
          category: EventCategory.AUTHENTICATION,
          outcome: EventOutcome.SUCCESS,
          actor: { id: 'user-2', type: ActorType.USER },
          source: { service: 'auth' },
        },
      ];

      const result = await logger.recordBatch({ events, all_or_nothing: true });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });

  describe('querying', () => {
    it('should query events', async () => {
      // First record some events
      await logger.record({
        action: 'test.action',
        category: EventCategory.SYSTEM_EVENT,
        outcome: EventOutcome.SUCCESS,
        actor: { id: 'system', type: ActorType.SYSTEM },
        source: { service: 'test' },
      });

      const result = await logger.query({
        pagination: { page: 1, page_size: 10 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.events).toBeDefined();
        expect(result.data.page).toBe(1);
      }
    });

    it('should validate date range', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2025-01-01'); // > 365 days

      const result = await logger.query({
        filters: {
          timestamp_start: startDate,
          timestamp_end: endDate,
        },
        pagination: { page: 1, page_size: 10 },
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('INVALID_DATE_RANGE');
      }
    });

    it('should get event by ID', async () => {
      const recordResult = await logger.record({
        action: 'test.action',
        category: EventCategory.SYSTEM_EVENT,
        outcome: EventOutcome.SUCCESS,
        actor: { id: 'system', type: ActorType.SYSTEM },
        source: { service: 'test' },
      });

      expect(recordResult.success).toBe(true);
      if (recordResult.success) {
        const event = await logger.getById(recordResult.event.id);
        expect(event).not.toBeNull();
        expect(event?.id).toBe(recordResult.event.id);
      }
    });
  });

  describe('hashing', () => {
    it('should generate event hash', async () => {
      const result = await logger.record({
        action: 'test.action',
        category: EventCategory.SYSTEM_EVENT,
        outcome: EventOutcome.SUCCESS,
        actor: { id: 'system', type: ActorType.SYSTEM },
        source: { service: 'test' },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.hash).toBeDefined();
        expect(result.event.hash).toHaveLength(64); // SHA-256 hex
      }
    });
  });

  describe('hooks', () => {
    it('should call beforeRecord hook', async () => {
      const beforeRecord = vi.fn((input: RecordInput) => ({
        ...input,
        metadata: { ...input.metadata, hooked: true },
      }));

      const loggerWithHook = createAuditLogger({
        storage,
        service: 'test-service',
        beforeRecord,
      });

      const result = await loggerWithHook.record({
        action: 'test.action',
        category: EventCategory.SYSTEM_EVENT,
        outcome: EventOutcome.SUCCESS,
        actor: { id: 'system', type: ActorType.SYSTEM },
        source: { service: 'test' },
      });

      expect(beforeRecord).toHaveBeenCalled();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.event.metadata?.hooked).toBe(true);
      }
    });

    it('should call afterRecord hook', async () => {
      const afterRecord = vi.fn();

      const loggerWithHook = createAuditLogger({
        storage,
        service: 'test-service',
        afterRecord,
      });

      await loggerWithHook.record({
        action: 'test.action',
        category: EventCategory.SYSTEM_EVENT,
        outcome: EventOutcome.SUCCESS,
        actor: { id: 'system', type: ActorType.SYSTEM },
        source: { service: 'test' },
      });

      expect(afterRecord).toHaveBeenCalled();
    });
  });

  describe('health check', () => {
    it('should report healthy status', async () => {
      const healthy = await logger.healthCheck();
      expect(healthy).toBe(true);
    });
  });
});
