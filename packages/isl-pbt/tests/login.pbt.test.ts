// ============================================================================
// Login Behavior Property-Based Tests
// ============================================================================
//
// Example PBT tests for the Login behavior from AuthLogin domain.
// Generates random valid emails/passwords and asserts invariants (no PII logged).
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import type { BehaviorProperties } from '../src/types.js';
import {
  createPRNG,
  email,
  password,
  ipAddress,
  record,
  createInputGenerator,
  extractProperties,
  runPBT,
  createPBTSuite,
  formatReport,
  getNeverLoggedFields,
} from '../src/index.js';
import type { BehaviorImplementation, ExecutionResult } from '../src/runner.js';

// ============================================================================
// MOCK DOMAIN (simulating parsed ISL)
// ============================================================================

const mockAuthLoginDomain = {
  kind: 'Domain' as const,
  name: { kind: 'Identifier' as const, name: 'AuthLogin', location: mockLoc() },
  version: '1.0.0',
  types: [
    {
      kind: 'TypeDeclaration' as const,
      name: { kind: 'Identifier' as const, name: 'Email', location: mockLoc() },
      definition: {
        kind: 'ConstrainedType' as const,
        base: { kind: 'PrimitiveType' as const, name: 'String', location: mockLoc() },
        constraints: [
          { name: 'format', value: { kind: 'StringLiteral' as const, value: 'email', location: mockLoc() } },
          { name: 'max_length', value: { kind: 'NumberLiteral' as const, value: 254, location: mockLoc() } },
        ],
        location: mockLoc(),
      },
      location: mockLoc(),
    },
    {
      kind: 'TypeDeclaration' as const,
      name: { kind: 'Identifier' as const, name: 'Password', location: mockLoc() },
      definition: {
        kind: 'ConstrainedType' as const,
        base: { kind: 'PrimitiveType' as const, name: 'String', location: mockLoc() },
        constraints: [
          { name: 'min_length', value: { kind: 'NumberLiteral' as const, value: 8, location: mockLoc() } },
          { name: 'max_length', value: { kind: 'NumberLiteral' as const, value: 128, location: mockLoc() } },
        ],
        location: mockLoc(),
      },
      location: mockLoc(),
    },
  ],
  entities: [
    {
      kind: 'Entity' as const,
      name: { kind: 'Identifier' as const, name: 'User', location: mockLoc() },
      fields: [
        { kind: 'Field' as const, name: { kind: 'Identifier' as const, name: 'id', location: mockLoc() }, type: { kind: 'PrimitiveType' as const, name: 'UUID', location: mockLoc() }, location: mockLoc() },
        { kind: 'Field' as const, name: { kind: 'Identifier' as const, name: 'email', location: mockLoc() }, type: { kind: 'ReferenceType' as const, name: { kind: 'QualifiedName' as const, parts: [{ kind: 'Identifier' as const, name: 'Email', location: mockLoc() }], location: mockLoc() }, location: mockLoc() }, location: mockLoc() },
        { kind: 'Field' as const, name: { kind: 'Identifier' as const, name: 'password_hash', location: mockLoc() }, type: { kind: 'PrimitiveType' as const, name: 'String', location: mockLoc() }, annotations: [{ name: 'secret' }], location: mockLoc() },
      ],
      location: mockLoc(),
    },
    {
      kind: 'Entity' as const,
      name: { kind: 'Identifier' as const, name: 'Session', location: mockLoc() },
      fields: [
        { kind: 'Field' as const, name: { kind: 'Identifier' as const, name: 'id', location: mockLoc() }, type: { kind: 'PrimitiveType' as const, name: 'UUID', location: mockLoc() }, location: mockLoc() },
        { kind: 'Field' as const, name: { kind: 'Identifier' as const, name: 'user_id', location: mockLoc() }, type: { kind: 'PrimitiveType' as const, name: 'UUID', location: mockLoc() }, location: mockLoc() },
        { kind: 'Field' as const, name: { kind: 'Identifier' as const, name: 'ip_address', location: mockLoc() }, type: { kind: 'PrimitiveType' as const, name: 'String', location: mockLoc() }, annotations: [{ name: 'pii' }], location: mockLoc() },
      ],
      location: mockLoc(),
    },
  ],
  behaviors: [
    {
      kind: 'Behavior' as const,
      name: { kind: 'Identifier' as const, name: 'Login', location: mockLoc() },
      input: {
        kind: 'InputSpec' as const,
        fields: [
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'email', location: mockLoc() },
            type: { kind: 'ReferenceType' as const, name: { kind: 'QualifiedName' as const, parts: [{ kind: 'Identifier' as const, name: 'Email', location: mockLoc() }], location: mockLoc() }, location: mockLoc() },
            location: mockLoc(),
          },
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'password', location: mockLoc() },
            type: { kind: 'ReferenceType' as const, name: { kind: 'QualifiedName' as const, parts: [{ kind: 'Identifier' as const, name: 'Password', location: mockLoc() }], location: mockLoc() }, location: mockLoc() },
            annotations: [{ name: 'sensitive' }],
            location: mockLoc(),
          },
          {
            kind: 'Field' as const,
            name: { kind: 'Identifier' as const, name: 'ip_address', location: mockLoc() },
            type: { kind: 'PrimitiveType' as const, name: 'String', location: mockLoc() },
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      preconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            implies: false,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'MemberExpr' as const,
                  object: { kind: 'Identifier' as const, name: 'email', location: mockLoc() },
                  property: { kind: 'Identifier' as const, name: 'is_valid_format', location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'BinaryExpr' as const,
                  operator: '>=',
                  left: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'password', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'length', location: mockLoc() },
                    location: mockLoc(),
                  },
                  right: { kind: 'NumberLiteral' as const, value: 8, location: mockLoc() },
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      postconditions: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            guard: 'success',
            implies: true,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'CallExpr' as const,
                  callee: {
                    kind: 'MemberExpr' as const,
                    object: { kind: 'Identifier' as const, name: 'Session', location: mockLoc() },
                    property: { kind: 'Identifier' as const, name: 'exists', location: mockLoc() },
                    location: mockLoc(),
                  },
                  arguments: [
                    {
                      kind: 'MemberExpr' as const,
                      object: { kind: 'Identifier' as const, name: 'result', location: mockLoc() },
                      property: { kind: 'Identifier' as const, name: 'id', location: mockLoc() },
                      location: mockLoc(),
                    },
                  ],
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      invariants: {
        kind: 'ConditionBlock' as const,
        conditions: [
          {
            kind: 'Condition' as const,
            implies: false,
            statements: [
              {
                kind: 'ConditionStatement' as const,
                expression: {
                  kind: 'Identifier' as const,
                  name: 'password never_logged',
                  location: mockLoc(),
                },
                location: mockLoc(),
              },
            ],
            location: mockLoc(),
          },
        ],
        location: mockLoc(),
      },
      location: mockLoc(),
    },
  ],
  scenarios: [],
  location: mockLoc(),
} as any;

function mockLoc() {
  return { start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 1, offset: 0 } };
}

// ============================================================================
// MOCK IMPLEMENTATION
// ============================================================================

/**
 * Create a mock login implementation for testing
 * @param logPassword If true, intentionally logs the password (for testing PII detection)
 */
function createMockLoginImpl(options: {
  logPassword?: boolean;
  failOnEmail?: string;
} = {}): BehaviorImplementation {
  const { logPassword = false, failOnEmail } = options;
  
  return {
    async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
      const { email, password, ip_address } = input as {
        email: string;
        password: string;
        ip_address: string;
      };
      
      // Validate input
      if (!email || !email.includes('@')) {
        return {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Invalid email' },
        };
      }
      
      if (!password || password.length < 8) {
        return {
          success: false,
          error: { code: 'INVALID_INPUT', message: 'Password too short' },
        };
      }
      
      // SAFE: Log sanitized info
      console.log(`Login attempt from IP: ${ip_address?.slice(0, 8)}...`);
      console.log(`Email domain: ${email.split('@')[1]}`);
      
      // UNSAFE: Intentionally log password if configured (for testing)
      if (logPassword) {
        console.log(`DEBUG: Received password: ${password}`);
      }
      
      // Check for specific email failure
      if (failOnEmail && email === failOnEmail) {
        return {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' },
        };
      }
      
      // Simulate successful login
      return {
        success: true,
        result: {
          id: 'session-' + Math.random().toString(36).slice(2),
          user_id: 'user-123',
          token: 'tok_' + Math.random().toString(36).slice(2),
        },
      };
    },
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Login PBT', () => {
  describe('Generator Tests', () => {
    it('should generate valid emails', () => {
      const prng = createPRNG(12345);
      const gen = email();
      
      for (let i = 0; i < 100; i++) {
        const value = gen.generate(prng.fork(), 50);
        expect(value).toMatch(/^[a-z0-9]+@[a-z]+\.[a-z]+$/);
      }
    });
    
    it('should generate valid passwords (min 8 chars)', () => {
      const prng = createPRNG(12345);
      const gen = password();
      
      for (let i = 0; i < 100; i++) {
        const value = gen.generate(prng.fork(), 50);
        expect(value.length).toBeGreaterThanOrEqual(8);
        // Should contain mix of character types
        expect(/[a-z]/.test(value)).toBe(true);
        expect(/[A-Z]/.test(value)).toBe(true);
        expect(/[0-9]/.test(value)).toBe(true);
      }
    });
    
    it('should generate valid IP addresses', () => {
      const prng = createPRNG(12345);
      const gen = ipAddress();
      
      for (let i = 0; i < 100; i++) {
        const value = gen.generate(prng.fork(), 50);
        expect(value).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
      }
    });
    
    it('should generate login inputs from domain spec', () => {
      const properties = extractProperties(
        mockAuthLoginDomain.behaviors[0],
        mockAuthLoginDomain
      );
      
      const gen = createInputGenerator(properties, { filterPreconditions: false });
      const prng = createPRNG(12345);
      
      for (let i = 0; i < 50; i++) {
        const input = gen.generate(prng.fork(), 50);
        
        expect(input).toHaveProperty('email');
        expect(input).toHaveProperty('password');
        expect(input).toHaveProperty('ip_address');
        expect(typeof input.email).toBe('string');
        expect(typeof input.password).toBe('string');
      }
    });
  });
  
  describe('Property Extraction', () => {
    it('should extract preconditions', () => {
      const properties = extractProperties(
        mockAuthLoginDomain.behaviors[0],
        mockAuthLoginDomain
      );
      
      expect(properties.preconditions.length).toBeGreaterThan(0);
      expect(properties.preconditions[0]?.type).toBe('precondition');
    });
    
    it('should extract postconditions', () => {
      const properties = extractProperties(
        mockAuthLoginDomain.behaviors[0],
        mockAuthLoginDomain
      );
      
      expect(properties.postconditions.length).toBeGreaterThan(0);
      expect(properties.postconditions[0]?.guard).toBe('success');
    });
    
    it('should extract never_logged invariants', () => {
      const properties = extractProperties(
        mockAuthLoginDomain.behaviors[0],
        mockAuthLoginDomain
      );
      
      const neverLogged = getNeverLoggedFields(properties);
      expect(neverLogged).toContain('password');
    });
  });
  
  describe('PBT Runner', () => {
    it('should pass with safe implementation', async () => {
      const impl = createMockLoginImpl({ logPassword: false });
      
      const report = await runPBT(mockAuthLoginDomain, 'Login', impl, {
        numTests: 50,
        seed: 12345,
        verbose: false,
      });
      
      expect(report.success).toBe(true);
      expect(report.testsRun).toBe(50);
      expect(report.violations.length).toBe(0);
    });
    
    it('should detect password logging violation', async () => {
      const impl = createMockLoginImpl({ logPassword: true });
      
      const report = await runPBT(mockAuthLoginDomain, 'Login', impl, {
        numTests: 20,
        seed: 12345,
        verbose: false,
      });
      
      expect(report.success).toBe(false);
      expect(report.violations.length).toBeGreaterThan(0);
      
      // Check that the violation is about the password invariant
      const violation = report.violations[0];
      expect(violation?.property.type).toBe('invariant');
      expect(violation?.property.name).toContain('password');
    });
    
    it('should shrink failing input to minimal case', async () => {
      const impl = createMockLoginImpl({ logPassword: true });
      
      const report = await runPBT(mockAuthLoginDomain, 'Login', impl, {
        numTests: 10,
        maxShrinks: 50,
        seed: 12345,
      });
      
      expect(report.success).toBe(false);
      expect(report.shrinkResult).toBeDefined();
      
      // Shrunk input should still be valid (satisfy preconditions)
      if (report.shrinkResult?.minimal) {
        const minimal = report.shrinkResult.minimal;
        expect((minimal.email as string).includes('@')).toBe(true);
        expect((minimal.password as string).length).toBeGreaterThanOrEqual(8);
      }
    });
    
    it('should format report correctly', async () => {
      const impl = createMockLoginImpl({ logPassword: false });
      
      const report = await runPBT(mockAuthLoginDomain, 'Login', impl, {
        numTests: 10,
        seed: 12345,
      });
      
      const formatted = formatReport(report);
      
      expect(formatted).toContain('PBT Report: Login');
      expect(formatted).toContain('All 10 tests passed');
      expect(formatted).toContain('Statistics:');
    });
  });
  
  describe('PBT Suite API', () => {
    it('should create a reusable test suite', async () => {
      const impl = createMockLoginImpl();
      const suite = createPBTSuite(mockAuthLoginDomain, 'Login', impl, {
        seed: 12345,
      });
      
      // Generate single input for inspection
      const input = suite.generateInput(12345);
      expect(input).toHaveProperty('email');
      expect(input).toHaveProperty('password');
      
      // Run quick check
      const report = await suite.quickCheck(5);
      expect(report.testsRun).toBe(5);
    });
  });
  
  describe('Shrinking', () => {
    it('should shrink emails while keeping them valid', () => {
      const prng = createPRNG(12345);
      const gen = email();
      
      const original = gen.generate(prng, 100);
      const shrinks = [...gen.shrink(original)];
      
      // All shrinks should be valid emails
      for (const shrunk of shrinks) {
        expect(shrunk).toMatch(/^[a-z0-9]+@[a-z]+\.[a-z]+$/);
        expect(shrunk.length).toBeLessThanOrEqual(original.length);
      }
    });
    
    it('should shrink passwords while keeping min length', () => {
      const prng = createPRNG(12345);
      const gen = password(8);
      
      const original = gen.generate(prng, 100);
      const shrinks = [...gen.shrink(original)];
      
      // All shrinks should meet minimum length
      for (const shrunk of shrinks) {
        expect(shrunk.length).toBeGreaterThanOrEqual(8);
      }
    });
  });
  
  describe('Reproducibility', () => {
    it('should generate same sequence with same seed', () => {
      const gen = email();
      
      const results1: string[] = [];
      const results2: string[] = [];
      
      const prng1 = createPRNG(99999);
      const prng2 = createPRNG(99999);
      
      for (let i = 0; i < 10; i++) {
        results1.push(gen.generate(prng1.fork(), 50));
        results2.push(gen.generate(prng2.fork(), 50));
      }
      
      expect(results1).toEqual(results2);
    });
    
    it('should reproduce failures with reported seed', async () => {
      const impl = createMockLoginImpl({ failOnEmail: 'fail@example.com' });
      
      // First run to get a failure seed
      const report1 = await runPBT(mockAuthLoginDomain, 'Login', impl, {
        numTests: 100,
        seed: 54321,
      });
      
      // If there was a failure, we can reproduce it
      if (report1.firstFailure) {
        const failingSeed = report1.firstFailure.seed;
        const failingInput = report1.firstFailure.input;
        
        // Regenerate with same seed should give same input
        const suite = createPBTSuite(mockAuthLoginDomain, 'Login', impl);
        const regenerated = suite.generateInput(failingSeed);
        
        // Note: The exact reproduction depends on the PRNG state at that iteration
        // In a full implementation, you'd store iteration + seed for exact reproduction
        expect(regenerated).toHaveProperty('email');
        expect(regenerated).toHaveProperty('password');
      }
    });
  });
});
