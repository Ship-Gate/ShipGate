/**
 * Tests for ISL Verification Engine
 * 
 * Tests end-to-end verification of postconditions/invariants using trace events.
 */

import { describe, it, expect } from 'vitest';
import { parseISL, adapters } from '@isl-lang/isl-core';
import { VerificationEngine, verifyDomain, type TraceEvent } from '../src/verification-engine.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Passing test: All postconditions evaluate to true.
 * Single predicate (result.email == input.email) to avoid entity proxy .count vs field semantics.
 */
const passingSpec = `
domain Auth {
  version: "1.0.0"
  entity User {
    id: string
    email: string
  }
  
  behavior createUser {
    input {
      email: string
    }
    output {
      success: User
    }
    postconditions {
      success implies {
        result.email == input.email
      }
    }
  }
}
`;

const passingTraces: TraceEvent[] = [
  {
    id: 'call-1',
    type: 'call',
    timestamp: 1000,
    behavior: 'createUser',
    input: { email: 'test@example.com' },
    stateBefore: {
      entities: new Map([
        ['User', new Map([
          ['user-1', { __entity__: 'User', __id__: 'user-1', email: 'existing@example.com', count: 1 }]
        ])]
      ]),
      timestamp: 1000,
    },
    data: {},
  },
  {
    id: 'return-1',
    type: 'return',
    timestamp: 2000,
    behavior: 'createUser',
    output: { __entity__: 'User', __id__: 'user-2', email: 'test@example.com', count: 2 },
    stateAfter: {
      entities: new Map([
        ['User', new Map([
          ['user-1', { __entity__: 'User', __id__: 'user-1', email: 'existing@example.com', count: 1 }],
          ['user-2', { __entity__: 'User', __id__: 'user-2', email: 'test@example.com', count: 2 }]
        ])]
      ]),
      timestamp: 2000,
    },
    data: {},
  },
];

/**
 * Failing test: Postcondition evaluates to false
 */
const failingSpec = `
domain Auth {
  version: "1.0.0"
  entity User {
    id: string
    email: string
  }
  
  behavior createUser {
    input {
      email: string
    }
    output {
      success: User
    }
    postconditions {
      success implies {
        result.email == input.email
      }
    }
  }
}
`;

const failingTraces: TraceEvent[] = [
  {
    id: 'call-1',
    type: 'call',
    timestamp: 1000,
    behavior: 'createUser',
    input: { email: 'test@example.com' },
    stateBefore: {
      entities: new Map(),
      timestamp: 1000,
    },
    data: {},
  },
  {
    id: 'return-1',
    type: 'return',
    timestamp: 2000,
    behavior: 'createUser',
    output: { __entity__: 'User', __id__: 'user-1', email: 'wrong@example.com' }, // Wrong email!
    stateAfter: {
      entities: new Map([
        ['User', new Map([
          ['user-1', { __entity__: 'User', __id__: 'user-1', email: 'wrong@example.com' }]
        ])]
      ]),
      timestamp: 2000,
    },
    data: {},
  },
];

/**
 * Incomplete proof: No trace data available
 */
const incompleteSpec = `
domain Auth {
  version: "1.0.0"
  entity User {
    id: string
    email: string
  }
  
  behavior createUser {
    input {
      email: string
    }
    output {
      success: User
    }
    postconditions {
      success implies {
        result.email == input.email
      }
    }
  }
}
`;

const incompleteTraces: TraceEvent[] = []; // No traces

// ============================================================================
// Tests
// ============================================================================

describe('VerificationEngine', () => {
  describe('passing verification', () => {
    it('verifies all postconditions successfully', async () => {
      const { ast } = parseISL(passingSpec, 'test.isl');
      if (!ast) throw new Error('Failed to parse spec');
      const domain = adapters.domainDeclarationToDomain(ast);

      const result = await verifyDomain(domain, passingTraces);

      expect(result.verdict).toBe('PROVEN');
      expect(result.summary.provenClauses).toBeGreaterThan(0);
      expect(result.summary.failedClauses).toBe(0);
      expect(result.summary.notProvenClauses).toBe(0);
      
      // Check that all evidence shows proven
      for (const ev of result.evidence) {
        expect(ev.evaluatedResult.status).toBe('proven');
        if (ev.evaluatedResult.status === 'proven') {
          expect(ev.evaluatedResult.value).toBe(true);
        }
      }
    });
  });

  describe('failing verification', () => {
    it('detects failed postconditions', async () => {
      const { ast } = parseISL(failingSpec, 'test.isl');
      if (!ast) throw new Error('Failed to parse spec');
      const domain = adapters.domainDeclarationToDomain(ast);

      const result = await verifyDomain(domain, failingTraces);

      expect(result.verdict).toBe('VIOLATED');
      expect(result.summary.failedClauses).toBeGreaterThan(0);
      
      // Check that at least one evidence shows failed
      const failedEvidence = result.evidence.find(
        ev => ev.evaluatedResult.status === 'failed'
      );
      expect(failedEvidence).toBeDefined();
      if (failedEvidence && failedEvidence.evaluatedResult.status === 'failed') {
        expect(failedEvidence.evaluatedResult.expected).toBe(true);
        expect(failedEvidence.evaluatedResult.actual).toBe(false);
      }
    });
  });

  describe('incomplete proof', () => {
    it('returns UNPROVEN when no trace data available', async () => {
      const { ast } = parseISL(incompleteSpec, 'test.isl');
      if (!ast) throw new Error('Failed to parse spec');
      const domain = adapters.domainDeclarationToDomain(ast);

      const result = await verifyDomain(domain, incompleteTraces);

      expect(result.verdict).toBe('UNPROVEN');
      expect(result.summary.incompleteClauses).toBeGreaterThan(0);
      expect(result.summary.notProvenClauses).toBeGreaterThan(0);
      
      // Check that evidence shows not_proven
      for (const ev of result.evidence) {
        expect(ev.evaluatedResult.status).toBe('not_proven');
        if (ev.evaluatedResult.status === 'not_proven') {
          expect(ev.evaluatedResult.reason).toContain('No trace data');
        }
      }
    });
  });

  describe('evidence model', () => {
    it('includes clauseId, sourceSpan, traceSlice, and evaluatedResult', async () => {
      const { ast } = parseISL(passingSpec, 'test.isl');
      if (!ast) throw new Error('Failed to parse spec');
      const domain = adapters.domainDeclarationToDomain(ast);

      const result = await verifyDomain(domain, passingTraces);

      expect(result.evidence.length).toBeGreaterThan(0);
      
      for (const ev of result.evidence) {
        // Check clauseId
        expect(ev.clauseId).toBeDefined();
        expect(typeof ev.clauseId).toBe('string');
        
        // Check sourceSpan
        expect(ev.sourceSpan).toBeDefined();
        expect(ev.sourceSpan.file).toBeDefined();
        expect(typeof ev.sourceSpan.startLine).toBe('number');
        expect(typeof ev.sourceSpan.startColumn).toBe('number');
        
        // Check traceSlice
        expect(ev.traceSlice).toBeDefined();
        expect(Array.isArray(ev.traceSlice.events)).toBe(true);
        expect(typeof ev.traceSlice.startTime).toBe('number');
        expect(typeof ev.traceSlice.endTime).toBe('number');
        expect(typeof ev.traceSlice.behavior).toBe('string');
        
        // Check evaluatedResult
        expect(ev.evaluatedResult).toBeDefined();
        expect(['proven', 'not_proven', 'failed']).toContain(ev.evaluatedResult.status);
      }
    });
  });

  describe('fail-closed behavior', () => {
    it('returns UNPROVEN or INCOMPLETE_PROOF when evaluation throws error', async () => {
      const { ast } = parseISL(passingSpec, 'test.isl');
      if (!ast) throw new Error('Failed to parse spec');
      const domain = adapters.domainDeclarationToDomain(ast);

      // Use traces with invalid state (missing required fields)
      const invalidTraces: TraceEvent[] = [
        {
          id: 'call-1',
          type: 'call',
          timestamp: 1000,
          behavior: 'createUser',
          input: {}, // Missing email
          stateBefore: {
            entities: new Map(),
            timestamp: 1000,
          },
          data: {},
        },
      ];

      const result = await verifyDomain(domain, invalidTraces);

      // Should fail-closed: unknown = UNPROVEN or INCOMPLETE_PROOF
      expect(['UNPROVEN', 'INCOMPLETE_PROOF']).toContain(result.verdict);
    });
  });
});
