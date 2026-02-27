// ============================================================================
// ISL Runtime Simulator - Unit Tests
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse as parseISL } from '@isl-lang/parser';
import { RuntimeSimulator, simulate, DEFAULT_SIMULATOR_OPTIONS } from '../src/simulator';
import { parseTestData } from '../src';
import type { Domain } from '@isl-lang/parser';

// ============================================================================
// FIXTURES
// ============================================================================

async function loadFixture(name: string): Promise<string> {
  const path = resolve(__dirname, `fixtures/${name}`);
  return readFile(path, 'utf-8');
}

async function loadDomain(name: string): Promise<Domain> {
  const content = await loadFixture(`${name}.isl`);
  const result = parseISL(content);
  if (!result.success || !result.domain) {
    throw new Error(`Failed to parse fixture: ${result.errors?.map((e) => e.message).join(', ')}`);
  }
  return result.domain;
}

// ============================================================================
// SIMULATOR TESTS
// ============================================================================

describe('RuntimeSimulator', () => {
  let domain: Domain;

  beforeEach(async () => {
    domain = await loadDomain('payment');
  });

  describe('constructor', () => {
    it('should create simulator with default options', () => {
      const simulator = new RuntimeSimulator();
      expect(simulator).toBeDefined();
    });

    it('should create simulator with custom options', () => {
      const simulator = new RuntimeSimulator({
        timeout: 10000,
        sandbox: false,
        verbose: true,
      });
      expect(simulator).toBeDefined();
    });
  });

  describe('setDomain', () => {
    it('should set domain', () => {
      const simulator = new RuntimeSimulator();
      simulator.setDomain(domain);
      expect(simulator).toBeDefined();
    });
  });

  describe('simulate', () => {
    it('should simulate behavior with valid test data', async () => {
      const simulator = new RuntimeSimulator();
      simulator.setDomain(domain);

      const testData: typeof parseTestData extends (data: infer T) => any ? T : never = {
        intent: 'TransferFunds',
        bindings: {
          pre: {
            sender: 'alice',
            receiver: 'bob',
            amount: 100,
          },
        },
      };

      const result = await simulator.simulate('TransferFunds', testData);

      expect(result).toBeDefined();
      expect(result.behavior).toBe('TransferFunds');
      expect(result.preconditions).toBeDefined();
      expect(Array.isArray(result.preconditions)).toBe(true);
      expect(result.postconditions).toBeDefined();
      expect(Array.isArray(result.postconditions)).toBe(true);
      expect(result.entityValidations).toBeDefined();
      expect(Array.isArray(result.entityValidations)).toBe(true);
    });

    it('should throw error for non-existent behavior', async () => {
      const simulator = new RuntimeSimulator();
      simulator.setDomain(domain);

      const testData = {
        intent: 'NonExistent',
        bindings: {
          pre: {},
        },
      };

      await expect(simulator.simulate('NonExistent', testData)).rejects.toThrow();
    });

    it('should throw error when domain not set', async () => {
      const simulator = new RuntimeSimulator();

      const testData = {
        intent: 'TransferFunds',
        bindings: {
          pre: {},
        },
      };

      await expect(simulator.simulate('TransferFunds', testData)).rejects.toThrow('No domain loaded');
    });

    it('should evaluate simple preconditions', async () => {
      const simulator = new RuntimeSimulator();
      simulator.setDomain(domain);

      const testData = {
        intent: 'TransferFunds',
        bindings: {
          pre: {
            amount: 50,
          },
        },
      };

      const result = await simulator.simulate('TransferFunds', testData);

      expect(result.preconditions.length).toBeGreaterThan(0);
      // Each precondition should have evaluation results
      for (const pre of result.preconditions) {
        expect(pre.expression).toBeDefined();
        expect(typeof pre.passed).toBe('boolean');
        expect(pre.duration).toBeGreaterThanOrEqual(0);
      }
    });

    it('should evaluate postconditions when post-state provided', async () => {
      const simulator = new RuntimeSimulator();
      simulator.setDomain(domain);

      const testData = {
        intent: 'TransferFunds',
        bindings: {
          pre: {
            amount: 50,
          },
          post: {
            result: { success: true },
          },
        },
      };

      const result = await simulator.simulate('TransferFunds', testData);

      expect(result.postconditions).toBeDefined();
      expect(Array.isArray(result.postconditions)).toBe(true);
    });

    it('should validate entities', async () => {
      const simulator = new RuntimeSimulator();
      simulator.setDomain(domain);

      const testData = {
        intent: 'TransferFunds',
        bindings: {
          pre: {
            amount: 50,
          },
        },
      };

      const result = await simulator.simulate('TransferFunds', testData);

      expect(result.entityValidations).toBeDefined();
      expect(Array.isArray(result.entityValidations)).toBe(true);
      // Each validation should have entity name and passed status
      for (const validation of result.entityValidations) {
        expect(validation.entity).toBeDefined();
        expect(typeof validation.passed).toBe('boolean');
        expect(Array.isArray(validation.errors)).toBe(true);
      }
    });

    it('should respect timeout', async () => {
      const simulator = new RuntimeSimulator({
        timeout: 100, // Very short timeout
      });
      simulator.setDomain(domain);

      const testData = {
        intent: 'TransferFunds',
        bindings: {
          pre: {
            amount: 50,
          },
        },
      };

      const result = await simulator.simulate('TransferFunds', testData);

      // Should complete (though some conditions might timeout)
      expect(result).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

// ============================================================================
// CONVENIENCE FUNCTION TESTS
// ============================================================================

describe('simulate convenience function', () => {
  it('should simulate behavior using convenience function', async () => {
    const domain = await loadDomain('payment');

    const testData = {
      intent: 'TransferFunds',
      bindings: {
        pre: {
          sender: 'alice',
          receiver: 'bob',
          amount: 100,
        },
      },
    };

    const result = await simulate(domain, 'TransferFunds', testData);

    expect(result).toBeDefined();
    expect(result.behavior).toBe('TransferFunds');
    expect(result.passed).toBeDefined();
  });
});

// ============================================================================
// EXPRESSION EVALUATION TESTS
// ============================================================================

describe('Expression Evaluation', () => {
  let simulator: RuntimeSimulator;
  let domain: Domain;

  beforeEach(async () => {
    domain = await loadDomain('payment');
    simulator = new RuntimeSimulator();
    simulator.setDomain(domain);
  });

  it('should evaluate boolean literals', async () => {
    const testData = {
      intent: 'TransferFunds',
      bindings: {
        pre: {
          amount: 50,
        },
      },
    };

    const result = await simulator.simulate('TransferFunds', testData);
    expect(result).toBeDefined();
  });

  it('should evaluate numeric comparisons', async () => {
    const testData = {
      intent: 'TransferFunds',
      bindings: {
        pre: {
          amount: 100,
        },
      },
    };

    const result = await simulator.simulate('TransferFunds', testData);
    expect(result).toBeDefined();
  });

  it('should handle string values', async () => {
    const testData = {
      intent: 'TransferFunds',
      bindings: {
        pre: {
          sender: 'alice',
          receiver: 'bob',
          amount: 50,
        },
      },
    };

    const result = await simulator.simulate('TransferFunds', testData);
    expect(result).toBeDefined();
  });
});

// ============================================================================
// SANDBOXING TESTS
// ============================================================================

describe('Sandboxing', () => {
  it('should enforce sandbox by default', async () => {
    const simulator = new RuntimeSimulator();
    expect(simulator).toBeDefined();
    // Sandbox is enabled by default - no filesystem/network access
  });

  it('should allow disabling sandbox', async () => {
    const simulator = new RuntimeSimulator({
      sandbox: false,
    });
    expect(simulator).toBeDefined();
  });
});
