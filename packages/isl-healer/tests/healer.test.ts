/**
 * Integration tests for healUntilShip engine
 *
 * Tests the complete healing loop:
 * - run gate --json
 * - map violations → recipes
 * - apply patches
 * - rerun gate
 *
 * With abort conditions:
 * - max_iterations
 * - stuck
 * - unknown_rule
 * - unsafe_patch_attempt (weakening)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ISLHealerV2,
  healUntilShip,
  createMockGateResult,
  createViolation,
  BUILTIN_RECIPES,
  FixRecipeRegistryImpl,
  WeakeningGuard,
  GateIngester,
} from '../src/index.js';
import type {
  ISLAST,
  GateResult,
  Violation,
  HealResult,
} from '../src/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestAST = (): ISLAST => ({
  kind: 'Domain',
  name: 'TestPayments',
  version: '1.0.0',
  entities: [],
  behaviors: [
    {
      name: 'ProcessPayment',
      preconditions: ['user.authenticated', 'amount > 0'],
      postconditions: ['transaction.recorded', 'audit.logged'],
      intents: [
        { tag: 'rate-limit-required', description: 'Protect against abuse' },
        { tag: 'audit-required', description: 'Log all payment attempts' },
        { tag: 'no-pii-logging', description: 'Never log sensitive data' },
        { tag: 'input-validation', description: 'Validate all inputs' },
      ],
      inputs: [],
      outputs: [],
      errors: [],
    },
  ],
  invariants: [],
  metadata: {
    generatedFrom: 'test',
    prompt: 'test',
    timestamp: new Date().toISOString(),
    confidence: 1.0,
  },
});

const createBrokenCode = (): Map<string, string> => {
  return new Map([
    [
      'app/api/payments/route.ts',
      `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  // This is a violation: console.log with user data
  console.log('Processing payment:', body);
  
  // No validation!
  const { amount, userId } = body;
  
  return NextResponse.json({ success: true });
}`,
    ],
  ]);
};

// ============================================================================
// Tests: Healing Loop
// ============================================================================

describe('healUntilShip', () => {
  describe('successful healing', () => {
    it('heals broken code to SHIP', async () => {
      const ast = createTestAST();
      const code = createBrokenCode();
      
      let iterationCount = 0;
      const maxIterationsNeeded = 3;
      
      // Mock gate that gradually improves
      const runGate = async (): Promise<GateResult> => {
        iterationCount++;
        
        if (iterationCount >= maxIterationsNeeded) {
          // All violations fixed
          return createMockGateResult('SHIP', [], 100);
        }
        
        // Return diminishing violations
        const violations: Violation[] = [];
        
        if (iterationCount === 1) {
          violations.push(
            createViolation('intent/rate-limit-required', 'app/api/payments/route.ts', 'Missing rate limiting', 3),
            createViolation('intent/audit-required', 'app/api/payments/route.ts', 'Missing audit', 10),
            createViolation('pii/console-in-production', 'app/api/payments/route.ts', 'Console.log in production', 7),
          );
        } else if (iterationCount === 2) {
          violations.push(
            createViolation('intent/audit-required', 'app/api/payments/route.ts', 'Missing audit', 10),
          );
        }
        
        return createMockGateResult('NO_SHIP', violations, 100 - violations.length * 10);
      };
      
      const result = await healUntilShip(ast, code, runGate, {
        maxIterations: 8,
        verbose: false,
      });
      
      expect(result.ok).toBe(true);
      expect(result.reason).toBe('ship');
      expect(result.iterations).toBe(maxIterationsNeeded);
      expect(result.gate.verdict).toBe('SHIP');
      expect(result.history.length).toBe(maxIterationsNeeded);
    });

    it('records full iteration history', async () => {
      const ast = createTestAST();
      const code = createBrokenCode();
      
      let callCount = 0;
      const runGate = async (): Promise<GateResult> => {
        callCount++;
        if (callCount >= 2) {
          return createMockGateResult('SHIP', [], 100);
        }
        return createMockGateResult('NO_SHIP', [
          createViolation('intent/rate-limit-required', 'app/api/payments/route.ts', 'Missing rate limiting', 3),
        ], 90);
      };
      
      const result = await healUntilShip(ast, code, runGate, { verbose: false });
      
      expect(result.history.length).toBe(2);
      expect(result.history[0].iteration).toBe(1);
      expect(result.history[0].violations.length).toBe(1);
      expect(result.history[1].iteration).toBe(2);
      expect(result.history[1].violations.length).toBe(0);
    });

    it('outputs CLI-style iteration progress', async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (msg: string) => logs.push(msg);
      
      try {
        const ast = createTestAST();
        const code = createBrokenCode();
        
        let callCount = 0;
        const runGate = async (): Promise<GateResult> => {
          callCount++;
          if (callCount >= 2) {
            return createMockGateResult('SHIP', [], 100);
          }
          return createMockGateResult('NO_SHIP', [
            createViolation('intent/rate-limit-required', 'app/api/payments/route.ts', 'Missing', 3),
          ], 90);
        };
        
        await healUntilShip(ast, code, runGate, { verbose: true });
        
        const output = logs.join('\n');
        expect(output).toContain('Iteration 1/8');
        expect(output).toContain('Iteration 2/8');
        expect(output).toContain('SHIP');
        expect(output).toContain('Score:');
        expect(output).toContain('Violations:');
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('abort: max_iterations', () => {
    it('aborts after max iterations', async () => {
      const ast = createTestAST();
      const code = createBrokenCode();
      
      // Gate always returns violations
      const runGate = async (): Promise<GateResult> => {
        return createMockGateResult('NO_SHIP', [
          createViolation('intent/rate-limit-required', 'app/api/payments/route.ts', 'Missing', 3),
        ], 80);
      };
      
      const result = await healUntilShip(ast, code, runGate, {
        maxIterations: 3,
        stopOnRepeat: 10, // High threshold to not trigger stuck
        verbose: false,
      });
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('max_iterations');
      expect(result.iterations).toBe(3);
    });
  });

  describe('abort: stuck', () => {
    it('aborts when same fingerprint repeats', async () => {
      const ast = createTestAST();
      const code = createBrokenCode();
      
      // Same violation every time
      const staticViolations = [
        createViolation('intent/rate-limit-required', 'app/api/payments/route.ts', 'Missing rate limiting', 3),
      ];
      
      const runGate = async (): Promise<GateResult> => {
        return createMockGateResult('NO_SHIP', staticViolations, 80);
      };
      
      const result = await healUntilShip(ast, code, runGate, {
        maxIterations: 10,
        stopOnRepeat: 2,
        verbose: false,
      });
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('stuck');
    });
  });

  describe('abort: unknown_rule', () => {
    it('aborts on unknown rule ID', async () => {
      const ast = createTestAST();
      const code = createBrokenCode();
      
      // Unknown rule violation
      const runGate = async (): Promise<GateResult> => {
        return createMockGateResult('NO_SHIP', [
          createViolation('custom/unknown-rule-xyz', 'app/api/payments/route.ts', 'Unknown violation', 3),
        ], 80);
      };
      
      const result = await healUntilShip(ast, code, runGate, {
        maxIterations: 8,
        verbose: false,
      });
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unknown_rule');
      expect(result.unknownRules).toContain('custom/unknown-rule-xyz');
    });

    it('lists all unknown rules', async () => {
      const ast = createTestAST();
      const code = createBrokenCode();
      
      const runGate = async (): Promise<GateResult> => {
        return createMockGateResult('NO_SHIP', [
          createViolation('custom/rule-1', 'file.ts', 'Unknown 1', 1),
          createViolation('custom/rule-2', 'file.ts', 'Unknown 2', 2),
          createViolation('intent/rate-limit-required', 'file.ts', 'Known', 3),
        ], 70);
      };
      
      const result = await healUntilShip(ast, code, runGate, { verbose: false });
      
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('unknown_rule');
      expect(result.unknownRules).toHaveLength(2);
      expect(result.unknownRules).toContain('custom/rule-1');
      expect(result.unknownRules).toContain('custom/rule-2');
    });
  });

  describe('abort: weakening_detected', () => {
    it('refuses patches with @ts-ignore', async () => {
      const guard = new WeakeningGuard();
      
      const result = guard.checkContent('// @ts-ignore');
      
      expect(result.detected).toBe(true);
      expect(result.matches[0].pattern.category).toBe('suppression');
    });

    it('refuses patches with eslint-disable', async () => {
      const guard = new WeakeningGuard();
      
      const result = guard.checkContent('// eslint-disable-next-line');
      
      expect(result.detected).toBe(true);
      expect(result.matches[0].pattern.category).toBe('suppression');
    });

    it('refuses patches with auth bypass', async () => {
      const guard = new WeakeningGuard();
      
      const result = guard.checkContent('skipAuth: true');
      
      expect(result.detected).toBe(true);
      expect(result.matches[0].pattern.category).toBe('auth_bypass');
    });

    it('refuses patches that broaden allowlists', async () => {
      const guard = new WeakeningGuard();
      
      const result = guard.checkContent("origin: '*'");
      
      expect(result.detected).toBe(true);
      expect(result.matches[0].pattern.category).toBe('allowlist');
    });
  });
});

// ============================================================================
// Tests: Recipe Registry
// ============================================================================

describe('FixRecipeRegistry', () => {
  it('has built-in recipes', () => {
    const registry = new FixRecipeRegistryImpl(BUILTIN_RECIPES);
    
    expect(registry.has('intent/rate-limit-required')).toBe(true);
    expect(registry.has('intent/audit-required')).toBe(true);
    expect(registry.has('intent/no-pii-logging')).toBe(true);
    expect(registry.has('pii/console-in-production')).toBe(true);
    expect(registry.has('intent/input-validation')).toBe(true);
  });

  it('detects unknown rules', () => {
    const registry = new FixRecipeRegistryImpl(BUILTIN_RECIPES);
    
    const violations: Violation[] = [
      createViolation('intent/rate-limit-required', 'file.ts', 'Known', 1),
      createViolation('custom/unknown', 'file.ts', 'Unknown', 2),
    ];
    
    const unknown = registry.findUnknownRules(violations);
    
    expect(unknown).toEqual(['custom/unknown']);
  });

  it('calculates coverage stats', () => {
    const registry = new FixRecipeRegistryImpl(BUILTIN_RECIPES);
    
    const violations: Violation[] = [
      createViolation('intent/rate-limit-required', 'file.ts', 'Known 1', 1),
      createViolation('intent/audit-required', 'file.ts', 'Known 2', 2),
      createViolation('custom/unknown', 'file.ts', 'Unknown', 3),
    ];
    
    const stats = registry.getCoverageStats(violations);
    
    expect(stats.total).toBe(3);
    expect(stats.covered).toBe(2);
    expect(stats.coverage).toBeCloseTo(66.67, 1);
    expect(stats.unknownRules).toEqual(['custom/unknown']);
  });
});

// ============================================================================
// Tests: Gate Ingester
// ============================================================================

describe('GateIngester', () => {
  it('parses ISL Studio JSON format', () => {
    const ingester = new GateIngester();
    
    const json = {
      verdict: 'NO_SHIP' as const,
      score: 75,
      violations: [
        {
          ruleId: 'auth/bypass-detected',
          message: 'Auth bypass detected',
          tier: 'hard_block' as const,
          filePath: 'src/api/users.ts',
          line: 10,
        },
      ],
      fingerprint: '1234567890abcdef',
      timestamp: '2024-01-01T00:00:00Z',
    };
    
    const result = ingester.parse(json);
    
    expect(result.format).toBe('json');
    expect(result.verdict).toBe('NO_SHIP');
    expect(result.score).toBe(75);
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].ruleId).toBe('auth/bypass-detected');
    expect(result.violations[0].severity).toBe('critical');
  });

  it('parses SARIF 2.1.0 format', () => {
    const ingester = new GateIngester();
    
    const sarif = {
      version: '2.1.0' as const,
      runs: [
        {
          tool: {
            driver: {
              name: 'test-tool',
              version: '1.0.0',
              rules: [
                {
                  id: 'SEC001',
                  name: 'Security Issue',
                  shortDescription: { text: 'A security issue was detected' },
                },
              ],
            },
          },
          results: [
            {
              ruleId: 'SEC001',
              level: 'error' as const,
              message: { text: 'Security vulnerability found' },
              locations: [
                {
                  physicalLocation: {
                    artifactLocation: { uri: 'src/api/users.ts' },
                    region: { startLine: 15, startColumn: 1 },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    
    const result = ingester.parse(sarif);
    
    expect(result.format).toBe('sarif');
    expect(result.violations.length).toBe(1);
    expect(result.violations[0].ruleId).toBe('SEC001');
    expect(result.violations[0].file).toBe('src/api/users.ts');
    expect(result.violations[0].span.startLine).toBe(15);
  });
});

// ============================================================================
// Tests: Proof Bundle
// ============================================================================

describe('ProofBundle', () => {
  it('includes iteration history', async () => {
    const ast = createTestAST();
    const code = createBrokenCode();
    
    let callCount = 0;
    const runGate = async (): Promise<GateResult> => {
      callCount++;
      if (callCount >= 2) {
        return createMockGateResult('SHIP', [], 100);
      }
      return createMockGateResult('NO_SHIP', [
        createViolation('intent/rate-limit-required', 'file.ts', 'Missing', 1),
      ], 90);
    };
    
    const result = await healUntilShip(ast, code, runGate, { verbose: false });
    
    expect(result.proof).toBeDefined();
    expect(result.proof.version).toBe('2.0.0');
    expect(result.proof.healing.performed).toBe(true);
    expect(result.proof.healing.iterations).toBe(2);
    expect(result.proof.healing.reason).toBe('ship');
    expect(result.proof.healing.history.length).toBe(2);
  });

  it('includes source information', async () => {
    const ast = createTestAST();
    const code = createBrokenCode();
    
    const runGate = async (): Promise<GateResult> => {
      return createMockGateResult('SHIP', [], 100);
    };
    
    const result = await healUntilShip(ast, code, runGate, { verbose: false });
    
    expect(result.proof.source.domain).toBe('TestPayments');
    expect(result.proof.source.version).toBe('1.0.0');
    expect(result.proof.source.hash).toBeTruthy();
  });

  it('includes evidence chain', async () => {
    const ast = createTestAST();
    const code = createBrokenCode();
    
    let callCount = 0;
    const runGate = async (): Promise<GateResult> => {
      callCount++;
      if (callCount >= 2) {
        return createMockGateResult('SHIP', [], 100);
      }
      return createMockGateResult('NO_SHIP', [
        createViolation('intent/rate-limit-required', 'file.ts', 'Missing', 1),
      ], 90);
    };
    
    const result = await healUntilShip(ast, code, runGate, { verbose: false });
    
    expect(result.proof.chain.length).toBeGreaterThan(0);
    expect(result.proof.chain[0].action).toBe('init');
    expect(result.proof.chain[result.proof.chain.length - 1].action).toBe('finalize');
  });
});

// ============================================================================
// Tests: ISL Spec Immutability
// ============================================================================

describe('ISL Spec Immutability', () => {
  it('freezes AST to prevent modification', () => {
    const ast = createTestAST();
    const code = createBrokenCode();
    
    const healer = new ISLHealerV2(ast, code, { verbose: false });
    
    // AST should be frozen
    const frozenAST = healer.getAST();
    
    expect(() => {
      // @ts-expect-error - Testing runtime freeze
      frozenAST.name = 'ModifiedName';
    }).toThrow();
  });
});
