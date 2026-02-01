// ============================================================================
// ISL Standard Library - PII Handling Tests
// @stdlib/audit/tests/pii
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  maskEmail,
  maskIpAddress,
  maskName,
  maskPii,
  redactPii,
  containsPii,
  getPiiFields,
} from '../implementations/typescript/utils/pii';
import {
  type AuditEvent,
  EventCategory,
  EventOutcome,
  ActorType,
} from '../implementations/typescript/types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createTestEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'event-123' as any,
    action: 'test.action',
    category: EventCategory.DATA_ACCESS,
    outcome: EventOutcome.SUCCESS,
    actor: {
      id: 'user-123' as any,
      type: ActorType.USER,
      name: 'John Doe',
      email: 'john.doe@example.com',
      ip_address: '192.168.1.100',
      session_id: 'session-abc',
    },
    source: {
      service: 'test-service',
    },
    timestamp: new Date(),
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('PII Handling', () => {
  describe('maskEmail', () => {
    it('should mask email addresses', () => {
      expect(maskEmail('john.doe@example.com')).toBe('j******e@e*****e.com');
      expect(maskEmail('a@b.com')).toBe('*@*.com');
      expect(maskEmail('test@domain.co.uk')).toBe('t**t@d****n.co.uk');
    });

    it('should handle edge cases', () => {
      expect(maskEmail('ab@cd.com')).toBe('**@**.com');
      expect(maskEmail('abc@def.org')).toBe('a*c@d*f.org');
    });
  });

  describe('maskIpAddress', () => {
    it('should mask IPv4 addresses', () => {
      expect(maskIpAddress('192.168.1.100')).toBe('192.***.***.100');
      expect(maskIpAddress('10.0.0.1')).toBe('10.***.***.1');
    });

    it('should mask IPv6 addresses', () => {
      const result = maskIpAddress('2001:0db8:85a3:0000:0000:8a2e:0370:7334');
      expect(result).toContain('2001');
      expect(result).toContain('****');
    });
  });

  describe('maskName', () => {
    it('should mask names', () => {
      expect(maskName('John Doe')).toBe('J*** D**');
      expect(maskName('Jane')).toBe('J***');
      expect(maskName('A B')).toBe('* *');
    });

    it('should handle multi-part names', () => {
      expect(maskName('John Paul Smith')).toBe('J*** P*** S****');
    });
  });

  describe('maskPii', () => {
    it('should mask all PII fields in an event', () => {
      const event = createTestEvent();
      const masked = maskPii(event);

      expect(masked.actor.email).not.toBe('john.doe@example.com');
      expect(masked.actor.email).toContain('@');
      expect(masked.actor.email).toContain('*');
      
      expect(masked.actor.ip_address).not.toBe('192.168.1.100');
      expect(masked.actor.ip_address).toContain('*');
      
      expect(masked.actor.name).not.toBe('John Doe');
      expect(masked.actor.name).toContain('*');
    });

    it('should preserve non-PII fields', () => {
      const event = createTestEvent();
      const masked = maskPii(event);

      expect(masked.actor.id).toBe(event.actor.id);
      expect(masked.actor.type).toBe(event.actor.type);
      expect(masked.actor.session_id).toBe(event.actor.session_id);
      expect(masked.action).toBe(event.action);
    });
  });

  describe('redactPii', () => {
    it('should completely redact PII fields', () => {
      const event = createTestEvent();
      const redacted = redactPii(event);

      expect(redacted.actor.email).toBe('[REDACTED]');
      expect(redacted.actor.ip_address).toBe('[REDACTED]');
      expect(redacted.actor.name).toBe('[REDACTED]');
    });

    it('should preserve non-PII fields', () => {
      const event = createTestEvent();
      const redacted = redactPii(event);

      expect(redacted.actor.id).toBe(event.actor.id);
      expect(redacted.actor.type).toBe(event.actor.type);
      expect(redacted.action).toBe(event.action);
    });
  });

  describe('containsPii', () => {
    it('should detect events with PII', () => {
      const event = createTestEvent();
      expect(containsPii(event)).toBe(true);
    });

    it('should return false for events without PII', () => {
      const event = createTestEvent({
        actor: {
          id: 'system' as any,
          type: ActorType.SYSTEM,
        },
      });
      expect(containsPii(event)).toBe(false);
    });
  });

  describe('getPiiFields', () => {
    it('should list all PII fields present', () => {
      const event = createTestEvent();
      const fields = getPiiFields(event);

      expect(fields).toContain('actor.email');
      expect(fields).toContain('actor.ip_address');
      expect(fields).toContain('actor.name');
    });

    it('should return empty array when no PII', () => {
      const event = createTestEvent({
        actor: {
          id: 'system' as any,
          type: ActorType.SYSTEM,
        },
      });
      const fields = getPiiFields(event);
      expect(fields).toHaveLength(0);
    });
  });
});
