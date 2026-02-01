// ============================================================================
// ISL Standard Library - Hashing Tests
// @stdlib/audit/tests/hashing
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  hashEvent,
  verifyEventHash,
  verifyEventChain,
  buildMerkleTree,
  getMerkleProof,
  verifyMerkleProof,
} from '../implementations/typescript/utils/hashing';
import {
  type AuditEvent,
  EventCategory,
  EventOutcome,
  ActorType,
} from '../implementations/typescript/types';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createTestEvent(id: string, previousHash?: string): AuditEvent {
  const event: AuditEvent = {
    id: id as any,
    action: 'test.action',
    category: EventCategory.DATA_ACCESS,
    outcome: EventOutcome.SUCCESS,
    actor: {
      id: 'user-123' as any,
      type: ActorType.USER,
    },
    source: {
      service: 'test-service',
      request_id: 'req-' + id,
    },
    timestamp: new Date('2024-01-01T00:00:00Z'),
    previous_hash: previousHash,
  };
  return event;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Event Hashing', () => {
  describe('hashEvent', () => {
    it('should generate consistent hash', () => {
      const event = createTestEvent('event-1');
      const hash1 = hashEvent(event);
      const hash2 = hashEvent(event);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should generate different hashes for different events', () => {
      const event1 = createTestEvent('event-1');
      const event2 = createTestEvent('event-2');

      const hash1 = hashEvent(event1);
      const hash2 = hashEvent(event2);

      expect(hash1).not.toBe(hash2);
    });

    it('should include previous_hash in calculation', () => {
      const event1 = createTestEvent('event-1');
      const event2 = createTestEvent('event-1', 'prev-hash');

      const hash1 = hashEvent(event1);
      const hash2 = hashEvent(event2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyEventHash', () => {
    it('should verify valid hash', () => {
      const event = createTestEvent('event-1');
      event.hash = hashEvent(event);

      expect(verifyEventHash(event)).toBe(true);
    });

    it('should reject invalid hash', () => {
      const event = createTestEvent('event-1');
      event.hash = 'invalid-hash';

      expect(verifyEventHash(event)).toBe(false);
    });

    it('should reject event without hash', () => {
      const event = createTestEvent('event-1');

      expect(verifyEventHash(event)).toBe(false);
    });
  });

  describe('verifyEventChain', () => {
    it('should verify valid chain', () => {
      const event1 = createTestEvent('event-1');
      event1.hash = hashEvent(event1);

      const event2 = createTestEvent('event-2', event1.hash);
      event2.hash = hashEvent(event2);
      event2.timestamp = new Date('2024-01-01T00:01:00Z');

      const event3 = createTestEvent('event-3', event2.hash);
      event3.hash = hashEvent(event3);
      event3.timestamp = new Date('2024-01-01T00:02:00Z');

      const result = verifyEventChain([event1, event2, event3]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.chainLength).toBe(3);
    });

    it('should detect broken chain', () => {
      const event1 = createTestEvent('event-1');
      event1.hash = hashEvent(event1);

      const event2 = createTestEvent('event-2', 'wrong-hash');
      event2.hash = hashEvent(event2);
      event2.timestamp = new Date('2024-01-01T00:01:00Z');

      const result = verifyEventChain([event1, event2]);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].type).toBe('BROKEN_CHAIN');
    });

    it('should detect tampered event', () => {
      const event1 = createTestEvent('event-1');
      event1.hash = hashEvent(event1);
      
      // Tamper with the event after hashing
      event1.action = 'tampered.action';

      const result = verifyEventChain([event1]);

      expect(result.valid).toBe(false);
      expect(result.errors[0].type).toBe('INVALID_HASH');
    });

    it('should handle empty chain', () => {
      const result = verifyEventChain([]);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

describe('Merkle Tree', () => {
  describe('buildMerkleTree', () => {
    it('should build tree from events', () => {
      const events = [
        createTestEvent('event-1'),
        createTestEvent('event-2'),
        createTestEvent('event-3'),
        createTestEvent('event-4'),
      ];

      // Add hashes
      events.forEach(e => { e.hash = hashEvent(e); });

      const tree = buildMerkleTree(events);

      expect(tree.root).toBeDefined();
      expect(tree.root).toHaveLength(64);
      expect(tree.leaves).toHaveLength(4);
      expect(tree.levels.length).toBeGreaterThan(1);
    });

    it('should handle odd number of events', () => {
      const events = [
        createTestEvent('event-1'),
        createTestEvent('event-2'),
        createTestEvent('event-3'),
      ];

      events.forEach(e => { e.hash = hashEvent(e); });

      const tree = buildMerkleTree(events);

      expect(tree.root).toBeDefined();
      expect(tree.leaves).toHaveLength(3);
    });

    it('should handle single event', () => {
      const events = [createTestEvent('event-1')];
      events[0].hash = hashEvent(events[0]);

      const tree = buildMerkleTree(events);

      expect(tree.root).toBe(events[0].hash);
    });

    it('should handle empty array', () => {
      const tree = buildMerkleTree([]);

      expect(tree.root).toBe('');
      expect(tree.leaves).toHaveLength(0);
    });
  });

  describe('getMerkleProof & verifyMerkleProof', () => {
    it('should generate and verify proof', () => {
      const events = [
        createTestEvent('event-1'),
        createTestEvent('event-2'),
        createTestEvent('event-3'),
        createTestEvent('event-4'),
      ];

      events.forEach(e => { e.hash = hashEvent(e); });

      const tree = buildMerkleTree(events);
      const proof = getMerkleProof(tree, 1);

      expect(proof.root).toBe(tree.root);
      expect(proof.leafHash).toBe(events[1].hash);
      expect(proof.leafIndex).toBe(1);
      expect(proof.proof.length).toBeGreaterThan(0);

      expect(verifyMerkleProof(proof)).toBe(true);
    });

    it('should reject invalid proof', () => {
      const events = [
        createTestEvent('event-1'),
        createTestEvent('event-2'),
        createTestEvent('event-3'),
        createTestEvent('event-4'),
      ];

      events.forEach(e => { e.hash = hashEvent(e); });

      const tree = buildMerkleTree(events);
      const proof = getMerkleProof(tree, 1);
      
      // Tamper with proof
      proof.leafHash = 'tampered-hash';

      expect(verifyMerkleProof(proof)).toBe(false);
    });
  });
});
