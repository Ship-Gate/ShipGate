// ============================================================================
// ISL Standard Library - Retention Tests
// @stdlib/audit/tests/retention
// ============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  RetentionManager,
  DEFAULT_RETENTION_POLICIES,
  validateCompliance,
} from '../implementations/typescript/utils/retention';
import {
  type AuditStorage,
  type AuditEvent,
  type RetentionPolicy,
  EventCategory,
  EventOutcome,
  ActorType,
} from '../implementations/typescript/types';

// ============================================================================
// MOCK STORAGE
// ============================================================================

function createMockStorage(): AuditStorage {
  return {
    insert: vi.fn(),
    insertBatch: vi.fn(),
    findById: vi.fn(),
    query: vi.fn().mockResolvedValue({ events: [], total_count: 0, page: 1, page_size: 100, has_more: false }),
    getStats: vi.fn(),
    deleteOlderThan: vi.fn().mockResolvedValue(5),
    healthCheck: vi.fn().mockResolvedValue(true),
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('RetentionManager', () => {
  let storage: AuditStorage;
  let manager: RetentionManager;

  beforeEach(() => {
    storage = createMockStorage();
    manager = new RetentionManager({
      storage,
      policies: DEFAULT_RETENTION_POLICIES,
    });
  });

  describe('policy management', () => {
    it('should have default policies', () => {
      const policies = manager.getAllPolicies();
      expect(policies.length).toBeGreaterThan(0);
    });

    it('should get policy for category', () => {
      const policy = manager.getPolicy(EventCategory.SECURITY_EVENT);
      expect(policy).toBeDefined();
      expect(policy?.retention_days).toBe(365);
    });

    it('should allow setting custom policy', () => {
      const customPolicy: RetentionPolicy = {
        category: EventCategory.SYSTEM_EVENT,
        retention_days: 60,
        compliance_standard: 'custom',
      };

      manager.setPolicy(customPolicy);
      const policy = manager.getPolicy(EventCategory.SYSTEM_EVENT);

      expect(policy?.retention_days).toBe(60);
    });
  });

  describe('retention date calculation', () => {
    it('should calculate retention date based on policy', () => {
      const timestamp = new Date('2024-01-01');
      const retentionDate = manager.calculateRetentionDate(
        EventCategory.SECURITY_EVENT,
        timestamp
      );

      const expectedDate = new Date('2025-01-01'); // 365 days later
      expect(retentionDate.getTime()).toBeCloseTo(expectedDate.getTime(), -4);
    });

    it('should use default retention for unknown category', () => {
      // Create manager without policies for some category
      const sparseManager = new RetentionManager({
        storage,
        policies: [],
      });

      const timestamp = new Date('2024-01-01');
      const retentionDate = sparseManager.calculateRetentionDate(
        EventCategory.SECURITY_EVENT,
        timestamp
      );

      // Default is 90 days
      const expectedDate = new Date('2024-04-01');
      expect(retentionDate.getTime()).toBeCloseTo(expectedDate.getTime(), -4);
    });
  });

  describe('run', () => {
    it('should execute retention run', async () => {
      const result = await manager.run();

      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeDefined();
      expect(result.deleted).toBeGreaterThanOrEqual(0);
      expect(storage.deleteOlderThan).toHaveBeenCalled();
    });

    it('should collect errors without throwing', async () => {
      (storage.deleteOlderThan as any).mockRejectedValueOnce(new Error('Test error'));

      const result = await manager.run();

      expect(result.completedAt).toBeDefined();
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('callbacks', () => {
    it('should call onDelete callback', async () => {
      const onDelete = vi.fn();
      const managerWithCallback = new RetentionManager({
        storage,
        policies: DEFAULT_RETENTION_POLICIES,
        onDelete,
      });

      await managerWithCallback.run();

      expect(onDelete).toHaveBeenCalled();
    });

    it('should call onError callback on failure', async () => {
      const onError = vi.fn();
      (storage.deleteOlderThan as any).mockRejectedValueOnce(new Error('Test error'));

      const managerWithCallback = new RetentionManager({
        storage,
        policies: DEFAULT_RETENTION_POLICIES,
        onError,
      });

      await managerWithCallback.run();

      expect(onError).toHaveBeenCalled();
    });
  });
});

describe('Compliance Validation', () => {
  describe('SOC2', () => {
    it('should validate compliant policies', () => {
      const result = validateCompliance(DEFAULT_RETENTION_POLICIES, 'SOC2');

      expect(result.compliant).toBe(true);
      expect(result.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should detect insufficient retention', () => {
      const shortPolicies: RetentionPolicy[] = [
        {
          category: EventCategory.SECURITY_EVENT,
          retention_days: 30, // Too short for SOC2
        },
      ];

      const result = validateCompliance(shortPolicies, 'SOC2');

      expect(result.compliant).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('should detect missing policies', () => {
      const incompletePolicies: RetentionPolicy[] = [
        {
          category: EventCategory.SECURITY_EVENT,
          retention_days: 365,
        },
        // Missing AUTHENTICATION and DATA_ACCESS policies
      ];

      const result = validateCompliance(incompletePolicies, 'SOC2');

      expect(result.compliant).toBe(false);
      expect(result.issues.some(i => i.message.includes('Missing'))).toBe(true);
    });
  });

  describe('PCI-DSS', () => {
    it('should validate compliant policies', () => {
      const result = validateCompliance(DEFAULT_RETENTION_POLICIES, 'PCI-DSS');

      expect(result.compliant).toBe(true);
    });
  });

  describe('HIPAA', () => {
    it('should require 6 year retention for data access', () => {
      const shortPolicies: RetentionPolicy[] = [
        {
          category: EventCategory.DATA_ACCESS,
          retention_days: 365, // HIPAA requires 6 years (2190 days)
        },
      ];

      const result = validateCompliance(shortPolicies, 'HIPAA');

      expect(result.compliant).toBe(false);
      expect(result.issues[0].message).toContain('2190');
    });
  });

  describe('SOX', () => {
    it('should require 7 year retention for modifications', () => {
      const shortPolicies: RetentionPolicy[] = [
        {
          category: EventCategory.DATA_MODIFICATION,
          retention_days: 365, // SOX requires 7 years (2555 days)
        },
      ];

      const result = validateCompliance(shortPolicies, 'SOX');

      expect(result.compliant).toBe(false);
    });
  });
});
