// ============================================================================
// Invalid Input Rejection Test with Tracing
// ============================================================================
//
// This test demonstrates how the PBT system handles invalid inputs:
// 1. Generates inputs that violate preconditions (email format, password length)
// 2. Shows that invalid inputs are properly rejected
// 3. Traces the rejection path without failing the overall proof
//
// Key preconditions from login.isl:
//   pre { email.is_valid_format }
//   pre { password.length >= 8 }
//   pre { password.length <= 128 }
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createPRNG,
  createLoginInputGenerator,
  validateLoginPreconditions,
  isValidEmailFormat,
  invalidEmail,
  invalidPassword,
  invalidLoginInput,
  shrinkLoginInput,
  validEmail,
  validPassword,
} from '../src/index.js';
import type { LoginInput } from '../src/login-generator.js';
import type { ExecutionResult } from '../src/runner.js';

// ============================================================================
// TRACE CAPTURE
// ============================================================================

interface TraceEntry {
  timestamp: number;
  type: 'precondition_check' | 'validation_error' | 'execution_result';
  input: Partial<LoginInput>;
  result: 'satisfied' | 'violated' | 'error';
  details: string;
}

class TestTracer {
  private traces: TraceEntry[] = [];

  clear(): void {
    this.traces = [];
  }

  trace(entry: Omit<TraceEntry, 'timestamp'>): void {
    this.traces.push({
      ...entry,
      timestamp: Date.now(),
    });
  }

  getTraces(): TraceEntry[] {
    return [...this.traces];
  }

  getViolations(): TraceEntry[] {
    return this.traces.filter(t => t.result === 'violated' || t.result === 'error');
  }

  formatTrace(): string {
    return this.traces.map(t => {
      const time = new Date(t.timestamp).toISOString();
      const email = t.input.email ? `email=${t.input.email.slice(0, 20)}...` : 'email=<none>';
      const pwd = t.input.password 
        ? `password.length=${t.input.password.length}` 
        : 'password=<none>';
      return `[${time}] ${t.type}: ${t.result} (${email}, ${pwd}) - ${t.details}`;
    }).join('\n');
  }
}

// ============================================================================
// MOCK LOGIN IMPLEMENTATION WITH TRACING
// ============================================================================

function createTracedLoginImpl(tracer: TestTracer) {
  return {
    async execute(input: Record<string, unknown>): Promise<ExecutionResult> {
      const email = input.email as string | undefined;
      const password = input.password as string | undefined;
      const loginInput: Partial<LoginInput> = { 
        email: email ?? '', 
        password: password ?? '' 
      };

      // Check email precondition
      if (!email || !isValidEmailFormat(email)) {
        tracer.trace({
          type: 'precondition_check',
          input: loginInput,
          result: 'violated',
          details: `Precondition violated: email.is_valid_format (got: ${email ?? '<null>'})`,
        });

        tracer.trace({
          type: 'validation_error',
          input: loginInput,
          result: 'error',
          details: 'INVALID_EMAIL_FORMAT',
        });

        return {
          success: false,
          error: { 
            code: 'INVALID_EMAIL_FORMAT', 
            message: 'Email must be a valid email address',
          },
        };
      }

      // Check password length >= 8 precondition
      if (!password || password.length < 8) {
        tracer.trace({
          type: 'precondition_check',
          input: loginInput,
          result: 'violated',
          details: `Precondition violated: password.length >= 8 (got: ${password?.length ?? 0})`,
        });

        tracer.trace({
          type: 'validation_error',
          input: loginInput,
          result: 'error',
          details: 'PASSWORD_TOO_SHORT',
        });

        return {
          success: false,
          error: { 
            code: 'PASSWORD_TOO_SHORT', 
            message: 'Password must be at least 8 characters',
          },
        };
      }

      // Check password length <= 128 precondition
      if (password.length > 128) {
        tracer.trace({
          type: 'precondition_check',
          input: loginInput,
          result: 'violated',
          details: `Precondition violated: password.length <= 128 (got: ${password.length})`,
        });

        tracer.trace({
          type: 'validation_error',
          input: loginInput,
          result: 'error',
          details: 'PASSWORD_TOO_LONG',
        });

        return {
          success: false,
          error: { 
            code: 'PASSWORD_TOO_LONG', 
            message: 'Password must be at most 128 characters',
          },
        };
      }

      // All preconditions satisfied
      tracer.trace({
        type: 'precondition_check',
        input: loginInput,
        result: 'satisfied',
        details: 'All preconditions passed',
      });

      tracer.trace({
        type: 'execution_result',
        input: loginInput,
        result: 'satisfied',
        details: 'Login successful',
      });

      return {
        success: true,
        result: {
          sessionId: 'sess-' + Math.random().toString(36).slice(2),
          userId: 'user-123',
        },
      };
    },
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Invalid Input Rejection with Tracing', () => {
  let tracer: TestTracer;

  beforeEach(() => {
    tracer = new TestTracer();
  });

  describe('Invalid Email Rejection', () => {
    it('should reject and trace emails without @ symbol', async () => {
      const impl = createTracedLoginImpl(tracer);
      
      const result = await impl.execute({
        email: 'not-an-email',
        password: 'validpassword123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_EMAIL_FORMAT');

      const violations = tracer.getViolations();
      expect(violations.length).toBe(2); // precondition + validation error
      expect(violations[0]!.details).toContain('email.is_valid_format');
    });

    it('should reject and trace empty email', async () => {
      const impl = createTracedLoginImpl(tracer);
      
      const result = await impl.execute({
        email: '',
        password: 'validpassword123',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_EMAIL_FORMAT');

      const violations = tracer.getViolations();
      expect(violations[0]!.details).toContain('email.is_valid_format');
    });

    it('should reject and trace malformed emails', async () => {
      const impl = createTracedLoginImpl(tracer);
      const invalidEmails = [
        '@domain.com',      // Missing local part
        'user@',            // Missing domain
        'user@@domain.com', // Double @
        'user name@x.com',  // Space in local
      ];

      for (const email of invalidEmails) {
        tracer.clear();
        const result = await impl.execute({
          email,
          password: 'validpassword123',
        });

        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('INVALID_EMAIL_FORMAT');
      }
    });
  });

  describe('Invalid Password Rejection', () => {
    it('should reject and trace passwords shorter than 8 characters', async () => {
      const impl = createTracedLoginImpl(tracer);
      
      const result = await impl.execute({
        email: 'user@example.com',
        password: 'short',  // 5 characters, less than 8
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PASSWORD_TOO_SHORT');

      const violations = tracer.getViolations();
      expect(violations.length).toBe(2);
      expect(violations[0]!.details).toContain('password.length >= 8');
    });

    it('should reject and trace empty password', async () => {
      const impl = createTracedLoginImpl(tracer);
      
      const result = await impl.execute({
        email: 'user@example.com',
        password: '',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PASSWORD_TOO_SHORT');

      const violations = tracer.getViolations();
      expect(violations[0]!.details).toContain('password.length >= 8');
    });

    it('should reject and trace passwords longer than 128 characters', async () => {
      const impl = createTracedLoginImpl(tracer);
      const longPassword = 'a'.repeat(129);  // 129 characters, more than 128
      
      const result = await impl.execute({
        email: 'user@example.com',
        password: longPassword,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PASSWORD_TOO_LONG');

      const violations = tracer.getViolations();
      expect(violations[0]!.details).toContain('password.length <= 128');
    });
  });

  describe('Valid Input Acceptance', () => {
    it('should accept and trace valid inputs', async () => {
      const impl = createTracedLoginImpl(tracer);
      
      const result = await impl.execute({
        email: 'user@example.com',
        password: 'validpassword123',  // 16 characters, within range
      });

      expect(result.success).toBe(true);
      expect(result.result).toHaveProperty('sessionId');

      const violations = tracer.getViolations();
      expect(violations.length).toBe(0);

      const traces = tracer.getTraces();
      expect(traces.some(t => t.result === 'satisfied')).toBe(true);
    });

    it('should accept password at exactly minimum length', async () => {
      const impl = createTracedLoginImpl(tracer);
      
      const result = await impl.execute({
        email: 'user@example.com',
        password: 'exactly8',  // Exactly 8 characters
      });

      expect(result.success).toBe(true);
    });

    it('should accept password at exactly maximum length', async () => {
      const impl = createTracedLoginImpl(tracer);
      const maxPassword = 'x'.repeat(128);  // Exactly 128 characters
      
      const result = await impl.execute({
        email: 'user@example.com',
        password: maxPassword,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Invalid Input Generator Integration', () => {
    it('should generate invalid emails using invalidEmail generator', () => {
      const prng = createPRNG(12345);
      const gen = invalidEmail();

      for (let i = 0; i < 50; i++) {
        const email = gen.generate(prng.fork(), 50);
        expect(isValidEmailFormat(email)).toBe(false);
      }
    });

    it('should generate invalid passwords using invalidPassword generator', () => {
      const prng = createPRNG(12345);
      const gen = invalidPassword({ minLength: 8, maxLength: 128 });

      for (let i = 0; i < 50; i++) {
        const password = gen.generate(prng.fork(), 50);
        // Should be either too short or too long
        expect(password.length < 8 || password.length > 128).toBe(true);
      }
    });

    it('should generate invalid login inputs using invalidLoginInput generator', () => {
      const prng = createPRNG(12345);
      const gen = invalidLoginInput({ minPasswordLength: 8, maxPasswordLength: 128 });

      for (let i = 0; i < 50; i++) {
        const input = gen.generate(prng.fork(), 50);
        const validation = validateLoginPreconditions(input);
        
        // At least one precondition should be violated
        expect(validation.valid).toBe(false);
        expect(validation.violations.length).toBeGreaterThan(0);
      }
    });

    it('should reject all invalid inputs and produce traces', async () => {
      const impl = createTracedLoginImpl(tracer);
      const prng = createPRNG(67890);
      const gen = invalidLoginInput();

      let allRejected = true;
      const rejectionCounts = {
        email: 0,
        password: 0,
        both: 0,
      };

      for (let i = 0; i < 20; i++) {
        tracer.clear();
        const input = gen.generate(prng.fork(), 50);
        
        const result = await impl.execute({
          email: input.email,
          password: input.password,
        });

        if (result.success) {
          allRejected = false;
        } else {
          // Count rejection types
          if (result.error?.code === 'INVALID_EMAIL_FORMAT') {
            rejectionCounts.email++;
          } else if (result.error?.code?.includes('PASSWORD')) {
            rejectionCounts.password++;
          }
        }

        // Should have violation traces
        expect(tracer.getViolations().length).toBeGreaterThan(0);
      }

      expect(allRejected).toBe(true);
      
      // Should have mixed violations
      expect(rejectionCounts.email + rejectionCounts.password).toBeGreaterThan(0);
    });
  });

  describe('Trace Format for Debugging', () => {
    it('should produce readable trace output', async () => {
      const impl = createTracedLoginImpl(tracer);

      // Run several test cases
      await impl.execute({ email: 'bad', password: 'short' });
      await impl.execute({ email: 'user@example.com', password: 'validpassword' });
      await impl.execute({ email: '', password: 'x'.repeat(200) });

      const traceOutput = tracer.formatTrace();
      
      // Should contain timestamps
      expect(traceOutput).toMatch(/\[\d{4}-\d{2}-\d{2}T/);
      
      // Should contain trace types
      expect(traceOutput).toContain('precondition_check');
      
      // Should contain results
      expect(traceOutput).toContain('violated');
      expect(traceOutput).toContain('satisfied');
    });
  });

  describe('Shrinking Invalid Inputs', () => {
    it('should shrink valid inputs while preserving preconditions', async () => {
      const impl = createTracedLoginImpl(tracer);
      
      // A valid input that we'll shrink
      const originalInput = {
        email: 'longusername@subdomain.example.com',
        password: 'aVeryLongAndComplexPassword123!@#',
        ip_address: '192.168.1.100',
      };

      // Test function that always passes (we're testing shrinking behavior)
      const testFn = async (input: Record<string, unknown>) => {
        const email = input.email as string;
        const password = input.password as string;
        
        // Validate preconditions
        if (!isValidEmailFormat(email)) return true; // Skip invalid
        if (password.length < 8 || password.length > 128) return true; // Skip invalid
        
        // Fail for specific pattern (to trigger shrinking)
        return email.length < 10;
      };

      const result = await shrinkLoginInput(originalInput, testFn, {
        maxShrinks: 50,
      });

      // Verify shrunk input still satisfies preconditions
      const shrunkEmail = result.minimal.email as string;
      const shrunkPassword = result.minimal.password as string;

      expect(isValidEmailFormat(shrunkEmail)).toBe(true);
      expect(shrunkPassword.length).toBeGreaterThanOrEqual(8);
      expect(shrunkPassword.length).toBeLessThanOrEqual(128);

      // Should have shrunk to something smaller
      expect(shrunkEmail.length).toBeLessThanOrEqual(originalInput.email.length);
    });
  });

  describe('Precondition Validation Utility', () => {
    it('should correctly identify valid inputs', () => {
      const valid = validateLoginPreconditions({
        email: 'user@example.com',
        password: 'password123',
      });

      expect(valid.valid).toBe(true);
      expect(valid.violations).toHaveLength(0);
    });

    it('should list all violations for invalid inputs', () => {
      const invalid = validateLoginPreconditions({
        email: 'not-email',
        password: 'short',
      });

      expect(invalid.valid).toBe(false);
      expect(invalid.violations.length).toBeGreaterThanOrEqual(2);
      expect(invalid.violations.some(v => v.includes('email'))).toBe(true);
      expect(invalid.violations.some(v => v.includes('password'))).toBe(true);
    });
  });

  describe('Reproducibility with Seeds', () => {
    it('should generate same invalid inputs with same seed', () => {
      const gen1 = invalidLoginInput();
      const gen2 = invalidLoginInput();
      
      const prng1 = createPRNG(11111);
      const prng2 = createPRNG(11111);

      const inputs1: LoginInput[] = [];
      const inputs2: LoginInput[] = [];

      for (let i = 0; i < 10; i++) {
        inputs1.push(gen1.generate(prng1.fork(), 50));
        inputs2.push(gen2.generate(prng2.fork(), 50));
      }

      expect(inputs1).toEqual(inputs2);
    });
  });
});
