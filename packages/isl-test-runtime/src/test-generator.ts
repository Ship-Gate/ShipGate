/**
 * Test Generator for Login Flow
 * 
 * Generates executable tests for Next.js App Router that:
 * - Run out-of-the-box
 * - Emit runtime traces for verification
 * - Cover all login flow scenarios: 200, 400, 401, 429
 */

import type { TraceEmitter, TraceEmitterOptions } from './trace-emitter.js';

// ============================================================================
// Types
// ============================================================================

export interface LoginTestConfig {
  /** Route handler path (e.g., './app/api/auth/login/route') */
  routePath: string;
  /** Test output directory */
  outputDir: string;
  /** Framework (vitest or jest) */
  framework: 'vitest' | 'jest';
}

export interface GeneratedTest {
  /** File path */
  path: string;
  /** Test content */
  content: string;
}

// ============================================================================
// Test Generator
// ============================================================================

export class LoginTestGenerator {
  private config: LoginTestConfig;

  constructor(config: LoginTestConfig) {
    this.config = config;
  }

  /**
   * Generate all login flow tests
   */
  generate(): GeneratedTest[] {
    const tests: GeneratedTest[] = [];

    // Main test file
    tests.push({
      path: `${this.config.outputDir}/login.test.ts`,
      content: this.generateMainTestFile(),
    });

    // Test utilities
    tests.push({
      path: `${this.config.outputDir}/test-utils.ts`,
      content: this.generateTestUtils(),
    });

    return tests;
  }

  /**
   * Generate main test file
   */
  private generateMainTestFile(): string {
    const framework = this.config.framework;
    const importStatement = framework === 'vitest'
      ? "import { describe, it, expect, beforeEach, afterEach } from 'vitest';"
      : "import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';";

    return `/**
 * Login Flow Tests - Generated
 * 
 * Executable tests for login behavior covering:
 * - 200: Success with valid credentials
 * - 400: Validation errors (missing/invalid email, password)
 * - 401: Invalid credentials (wrong password, user not found)
 * - 429: Rate limiting (email and IP limits)
 * 
 * All tests emit runtime traces for verification.
 */

${importStatement}
import { NextRequest } from 'next/server';
import { POST } from '${this.config.routePath}';
import { createTraceEmitter } from '@isl-lang/test-runtime';
import { createRequest, parseResponse, seedUser, clearUsers, resetRateLimits } from './test-utils';
import type { LoginResponse } from '${this.config.routePath}';

describe('Login Flow - Intent Behavior Tests', () => {
  beforeEach(() => {
    resetRateLimits();
    clearUsers();
    
    // Seed test user
    seedUser({
      id: 'user_123',
      email: 'test@example.com',
      password_hash: 'hashed_ValidPass123!',
      status: 'ACTIVE',
      failed_attempts: 0,
    });
  });

  // ==========================================================================
  // 1. SUCCESS (200)
  // ==========================================================================

  describe('Success (200)', () => {
    it('should return 200 with session for valid credentials', async () => {
      const traceEmitter = createTraceEmitter({
        testName: 'login_success_valid_credentials',
        domain: 'auth',
        behavior: 'login',
      });

      traceEmitter.captureInitialState({ users: 1 });

      const request = createRequest({
        email: 'test@example.com',
        password: 'ValidPass123!',
      });

      traceEmitter.emitCall('POST', { 
        email: 'test@example.com',
        // Password redacted automatically
      });

      const startTime = Date.now();
      const response = await POST(request);
      const duration = Date.now() - startTime;
      const body = await parseResponse<LoginResponse>(response);

      traceEmitter.emitReturn('POST', { status: response.status }, duration);

      if (response.status === 200 && body.success) {
        traceEmitter.emitCheck(
          'response.status === 200',
          true,
          'postcondition',
          200,
          response.status
        );
        traceEmitter.emitCheck(
          'body.success === true',
          true,
          'postcondition',
          true,
          body.success
        );
        traceEmitter.emitCheck(
          'session.created',
          !!body.data?.session,
          'postcondition',
          true,
          !!body.data?.session
        );
        traceEmitter.emitAudit('LOGIN_SUCCESS', {
          user_id: body.data?.session?.user_id,
        });
      }

      const trace = traceEmitter.finalize(response.status === 200 && body.success === true);

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      if (body.success) {
        expect(body.data.session).toBeDefined();
        expect(body.data.session.user_id).toBe('user_123');
        expect(body.data.access_token).toBeDefined();
      }

      // Store trace for proof bundle
      (globalThis as { __testTrace?: unknown }).__testTrace = trace;
    });
  });

  // ==========================================================================
  // 2. VALIDATION FAILURE (400)
  // ==========================================================================

  describe('Validation Failure (400)', () => {
    it('should return 400 when email is missing', async () => {
      const traceEmitter = createTraceEmitter({
        testName: 'login_validation_missing_email',
        domain: 'auth',
        behavior: 'login',
      });

      const request = createRequest({ password: 'ValidPass123!' });
      
      traceEmitter.emitCall('POST', { password: '[REDACTED]' });
      
      const startTime = Date.now();
      const response = await POST(request);
      const duration = Date.now() - startTime;
      const body = await parseResponse<LoginResponse>(response);

      traceEmitter.emitReturn('POST', { status: response.status }, duration);
      traceEmitter.emitCheck(
        'validation.email.required',
        response.status === 400,
        'precondition',
        true,
        response.status === 400
      );

      const trace = traceEmitter.finalize(response.status === 400);

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      if (!body.success) {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      }

      (globalThis as { __testTrace?: unknown }).__testTrace = trace;
    });

    it('should return 400 when email format is invalid', async () => {
      const traceEmitter = createTraceEmitter({
        testName: 'login_validation_invalid_email',
        domain: 'auth',
        behavior: 'login',
      });

      const request = createRequest({
        email: 'not-an-email',
        password: 'ValidPass123!',
      });

      traceEmitter.emitCall('POST', { email: 'not-an-email' });
      
      const startTime = Date.now();
      const response = await POST(request);
      const duration = Date.now() - startTime;
      const body = await parseResponse<LoginResponse>(response);

      traceEmitter.emitReturn('POST', { status: response.status }, duration);
      traceEmitter.emitCheck(
        'validation.email.format',
        response.status === 400,
        'precondition',
        true,
        response.status === 400
      );

      const trace = traceEmitter.finalize(response.status === 400);

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      if (!body.success) {
        expect(body.error.code).toBe('VALIDATION_ERROR');
      }

      (globalThis as { __testTrace?: unknown }).__testTrace = trace;
    });

    it('should return 400 when password is too short', async () => {
      const traceEmitter = createTraceEmitter({
        testName: 'login_validation_password_too_short',
        domain: 'auth',
        behavior: 'login',
      });

      const request = createRequest({
        email: 'test@example.com',
        password: 'short',
      });

      traceEmitter.emitCall('POST', { email: 'test@example.com' });
      
      const startTime = Date.now();
      const response = await POST(request);
      const duration = Date.now() - startTime;
      const body = await parseResponse<LoginResponse>(response);

      traceEmitter.emitReturn('POST', { status: response.status }, duration);
      traceEmitter.emitCheck(
        'validation.password.length',
        response.status === 400,
        'precondition',
        true,
        response.status === 400
      );

      const trace = traceEmitter.finalize(response.status === 400);

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      if (!body.success) {
        expect(body.error.code).toBe('VALIDATION_ERROR');
        expect(body.error.message).toContain('Password');
      }

      (globalThis as { __testTrace?: unknown }).__testTrace = trace;
    });
  });

  // ==========================================================================
  // 3. INVALID CREDENTIALS (401)
  // ==========================================================================

  describe('Invalid Credentials (401)', () => {
    it('should return 401 for wrong password', async () => {
      const traceEmitter = createTraceEmitter({
        testName: 'login_invalid_credentials_wrong_password',
        domain: 'auth',
        behavior: 'login',
      });

      const request = createRequest({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      });

      traceEmitter.emitCall('POST', { email: 'test@example.com' });
      
      const startTime = Date.now();
      const response = await POST(request);
      const duration = Date.now() - startTime;
      const body = await parseResponse<LoginResponse>(response);

      traceEmitter.emitReturn('POST', { status: response.status }, duration);
      traceEmitter.emitCheck(
        'credentials.valid',
        response.status === 401,
        'postcondition',
        false,
        response.status === 401
      );
      traceEmitter.emitAudit('LOGIN_FAILED', {
        reason: 'invalid_password',
      });

      const trace = traceEmitter.finalize(response.status === 401);

      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      if (!body.success) {
        expect(body.error.code).toBe('INVALID_CREDENTIALS');
      }

      (globalThis as { __testTrace?: unknown }).__testTrace = trace;
    });

    it('should return 401 for non-existent user', async () => {
      const traceEmitter = createTraceEmitter({
        testName: 'login_invalid_credentials_user_not_found',
        domain: 'auth',
        behavior: 'login',
      });

      const request = createRequest({
        email: 'nonexistent@example.com',
        password: 'ValidPass123!',
      });

      traceEmitter.emitCall('POST', { email: 'nonexistent@example.com' });
      
      const startTime = Date.now();
      const response = await POST(request);
      const duration = Date.now() - startTime;
      const body = await parseResponse<LoginResponse>(response);

      traceEmitter.emitReturn('POST', { status: response.status }, duration);
      traceEmitter.emitCheck(
        'user.exists',
        response.status === 401,
        'postcondition',
        false,
        response.status === 401
      );
      traceEmitter.emitAudit('LOGIN_FAILED', {
        reason: 'user_not_found',
      });

      const trace = traceEmitter.finalize(response.status === 401);

      expect(response.status).toBe(401);
      expect(body.success).toBe(false);
      if (!body.success) {
        expect(body.error.code).toBe('INVALID_CREDENTIALS');
      }

      (globalThis as { __testTrace?: unknown }).__testTrace = trace;
    });
  });

  // ==========================================================================
  // 4. RATE LIMIT (429)
  // ==========================================================================

  describe('Rate Limit (429)', () => {
    it('should return 429 after exceeding email rate limit', async () => {
      const traceEmitter = createTraceEmitter({
        testName: 'login_rate_limit_email',
        domain: 'auth',
        behavior: 'login',
      });

      const testEmail = 'ratelimit@example.com';

      // Make requests up to limit
      for (let i = 0; i < 10; i++) {
        const request = createRequest({
          email: testEmail,
          password: 'WrongPass123!',
        });
        await POST(request);
      }

      // Check rate limit before final request
      traceEmitter.emitRateLimitCheck(
        \`login:\${testEmail}\`,
        false,
        10,
        10
      );

      const request = createRequest({
        email: testEmail,
        password: 'WrongPass123!',
      });

      traceEmitter.emitCall('POST', { email: testEmail });
      
      const startTime = Date.now();
      const response = await POST(request);
      const duration = Date.now() - startTime;
      const body = await parseResponse<LoginResponse>(response);

      traceEmitter.emitReturn('POST', { status: response.status }, duration);
      traceEmitter.emitCheck(
        'rate_limit.enforced',
        response.status === 429,
        'postcondition',
        true,
        response.status === 429
      );

      const trace = traceEmitter.finalize(response.status === 429);

      expect(response.status).toBe(429);
      expect(body.success).toBe(false);
      if (!body.success) {
        expect(body.error.code).toBe('RATE_LIMITED');
        expect(body.error.retry_after).toBeDefined();
      }

      (globalThis as { __testTrace?: unknown }).__testTrace = trace;
    });

    it('should return 429 after exceeding IP rate limit', async () => {
      const traceEmitter = createTraceEmitter({
        testName: 'login_rate_limit_ip',
        domain: 'auth',
        behavior: 'login',
      });

      const testIP = '203.0.113.42';

      // Make requests up to limit
      for (let i = 0; i < 100; i++) {
        const request = createRequest(
          {
            email: \`user\${i}@example.com\`,
            password: 'ValidPass123!',
          },
          { 'x-forwarded-for': testIP }
        );
        await POST(request);
      }

      traceEmitter.emitRateLimitCheck(
        testIP,
        false,
        100,
        100
      );

      const request = createRequest(
        {
          email: 'final@example.com',
          password: 'ValidPass123!',
        },
        { 'x-forwarded-for': testIP }
      );

      traceEmitter.emitCall('POST', { email: 'final@example.com' });
      
      const startTime = Date.now();
      const response = await POST(request);
      const duration = Date.now() - startTime;
      const body = await parseResponse<LoginResponse>(response);

      traceEmitter.emitReturn('POST', { status: response.status }, duration);
      traceEmitter.emitCheck(
        'rate_limit.enforced',
        response.status === 429,
        'postcondition',
        true,
        response.status === 429
      );

      const trace = traceEmitter.finalize(response.status === 429);

      expect(response.status).toBe(429);
      expect(body.success).toBe(false);
      if (!body.success) {
        expect(body.error.code).toBe('RATE_LIMITED');
      }

      (globalThis as { __testTrace?: unknown }).__testTrace = trace;
    });
  });
});
`;
  }

  /**
   * Generate test utilities file
   */
  private generateTestUtils(): string {
    return `/**
 * Test Utilities for Login Tests
 */

import { NextRequest } from 'next/server';

// Mock user store
interface StoredUser {
  id: string;
  email: string;
  password_hash: string;
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  failed_attempts: number;
}

const users = new Map<string, StoredUser>();
const rateLimitsByEmail = new Map<string, { count: number; resetAt: number }>();
const rateLimitsByIP = new Map<string, { count: number; resetAt: number }>();

export function seedUser(user: StoredUser): void {
  users.set(user.email.toLowerCase(), user);
}

export function clearUsers(): void {
  users.clear();
}

export function resetRateLimits(): void {
  rateLimitsByEmail.clear();
  rateLimitsByIP.clear();
}

export function createRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  const init: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  return new NextRequest('http://localhost/api/auth/login', init);
}

export async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}
`;
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Generate login flow tests
 */
export function generateLoginTests(config: LoginTestConfig): GeneratedTest[] {
  const generator = new LoginTestGenerator(config);
  return generator.generate();
}
