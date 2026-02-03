/**
 * Login Route Tests
 * 
 * Test suite validating intent behaviors for the login route:
 * 1. Validation failure (400) - Invalid input format
 * 2. Rate limit (429) - Too many requests
 * 3. Invalid credentials (401) - Wrong password/user not found
 * 4. Success (200) - Valid credentials
 * 
 * Security invariants verified:
 * - Passwords are NEVER logged
 * - PII is redacted in all logs
 * 
 * Proof bundle captures "X passed, 0 failed"
 */

import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import {
  POST,
  validateLoginInput,
  resetRateLimits,
  seedUser,
  clearUsers,
  getUser,
  type LoginResponse,
} from './route';
import {
  enableLogCapture,
  disableLogCapture,
  getCapturedLogs,
  clearCapturedLogs,
  assertNoLoggedPII,
  redactPII,
} from './safe-logging';
import { createProofBundle, type ProofBundle } from './test-harness';

// ============================================================================
// Test Utilities
// ============================================================================

function createRequest(
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

async function parseResponse<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Login Route - Intent Behavior Tests', () => {
  const proofBundle: ProofBundle = {
    startTime: new Date().toISOString(),
    tests: [],
    passed: 0,
    failed: 0,
  };

  beforeEach(() => {
    resetRateLimits();
    clearUsers();
    clearCapturedLogs();
    enableLogCapture();

    // Seed test user
    seedUser({
      id: 'user_123',
      email: 'test@example.com',
      password_hash: 'hashed_ValidPass123!',
      status: 'ACTIVE',
      failed_attempts: 0,
    });
  });

  afterEach(() => {
    disableLogCapture();
  });

  afterAll(() => {
    proofBundle.endTime = new Date().toISOString();
    proofBundle.summary = `${proofBundle.passed} passed, ${proofBundle.failed} failed`;
    
    // Output proof bundle
    console.log('\n========================================');
    console.log('PROOF BUNDLE');
    console.log('========================================');
    console.log(JSON.stringify(proofBundle, null, 2));
  });

  // ==========================================================================
  // 1. VALIDATION FAILURE (400)
  // ==========================================================================

  describe('Validation Failure (400)', () => {
    it('should return 400 when email is missing', async () => {
      const testName = 'validation_missing_email';
      const startTime = Date.now();

      const request = createRequest({ password: 'ValidPass123!' });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        expect(response.status).toBe(400);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('VALIDATION_ERROR');
          expect(body.error.message).toContain('Email');
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should return 400 when email format is invalid', async () => {
      const testName = 'validation_invalid_email_format';
      const startTime = Date.now();

      const request = createRequest({
        email: 'not-an-email',
        password: 'ValidPass123!',
      });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        expect(response.status).toBe(400);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('VALIDATION_ERROR');
          expect(body.error.message).toContain('Email');
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should return 400 when password is too short', async () => {
      const testName = 'validation_password_too_short';
      const startTime = Date.now();

      const request = createRequest({
        email: 'test@example.com',
        password: 'short',
      });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        expect(response.status).toBe(400);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('VALIDATION_ERROR');
          expect(body.error.message).toContain('Password');
          expect(body.error.message).toContain('8');
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should return 400 when password is missing', async () => {
      const testName = 'validation_missing_password';
      const startTime = Date.now();

      const request = createRequest({ email: 'test@example.com' });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        expect(response.status).toBe(400);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('VALIDATION_ERROR');
          expect(body.error.message).toContain('Password');
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('validateLoginInput should detect all validation errors', () => {
      const testName = 'validateLoginInput_unit';
      const startTime = Date.now();

      try {
        // Empty object
        expect(validateLoginInput({}).valid).toBe(false);
        
        // Invalid email
        expect(validateLoginInput({ email: 'bad', password: 'ValidPass1' }).valid).toBe(false);
        
        // Short password
        expect(validateLoginInput({ email: 'a@b.com', password: 'short' }).valid).toBe(false);
        
        // Valid input
        expect(validateLoginInput({ email: 'a@b.com', password: 'ValidPass1' }).valid).toBe(true);

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });
  });

  // ==========================================================================
  // 2. RATE LIMIT (429)
  // ==========================================================================

  describe('Rate Limit (429)', () => {
    it('should return 429 after exceeding email rate limit (10/hour)', async () => {
      const testName = 'rate_limit_by_email';
      const startTime = Date.now();

      try {
        // Make 10 requests (limit)
        for (let i = 0; i < 10; i++) {
          const request = createRequest({
            email: 'ratelimit@example.com',
            password: 'WrongPass123!',
          });
          await POST(request);
        }

        // 11th request should be rate limited
        const request = createRequest({
          email: 'ratelimit@example.com',
          password: 'WrongPass123!',
        });
        const response = await POST(request);
        const body = await parseResponse<LoginResponse>(response);

        expect(response.status).toBe(429);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('RATE_LIMITED');
          expect(body.error.retriable).toBe(true);
          expect(body.error.retry_after).toBeDefined();
          expect(body.error.retry_after).toBeGreaterThan(0);
        }

        // Verify Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        expect(retryAfter).toBeDefined();

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should return 429 after exceeding IP rate limit (100/hour)', async () => {
      const testName = 'rate_limit_by_ip';
      const startTime = Date.now();

      try {
        const testIP = '203.0.113.42';
        
        // Make 100 requests from same IP (different emails to avoid email limit)
        for (let i = 0; i < 100; i++) {
          const request = createRequest(
            {
              email: `user${i}@example.com`,
              password: 'ValidPass123!',
            },
            { 'x-forwarded-for': testIP }
          );
          await POST(request);
        }

        // 101st request should be rate limited
        const request = createRequest(
          {
            email: 'final@example.com',
            password: 'ValidPass123!',
          },
          { 'x-forwarded-for': testIP }
        );
        const response = await POST(request);
        const body = await parseResponse<LoginResponse>(response);

        expect(response.status).toBe(429);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('RATE_LIMITED');
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });
  });

  // ==========================================================================
  // 3. INVALID CREDENTIALS (401)
  // ==========================================================================

  describe('Invalid Credentials (401)', () => {
    it('should return 401 for wrong password', async () => {
      const testName = 'invalid_credentials_wrong_password';
      const startTime = Date.now();

      const request = createRequest({
        email: 'test@example.com',
        password: 'WrongPassword123!',
      });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        expect(response.status).toBe(401);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('INVALID_CREDENTIALS');
          expect(body.error.retriable).toBe(true);
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should return 401 for non-existent user (same as wrong password)', async () => {
      const testName = 'invalid_credentials_user_not_found';
      const startTime = Date.now();

      const request = createRequest({
        email: 'nonexistent@example.com',
        password: 'ValidPass123!',
      });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        // Should return same error as wrong password (prevent enumeration)
        expect(response.status).toBe(401);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('INVALID_CREDENTIALS');
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should return 401 for locked account', async () => {
      const testName = 'invalid_credentials_account_locked';
      const startTime = Date.now();

      // Seed locked user
      seedUser({
        id: 'user_locked',
        email: 'locked@example.com',
        password_hash: 'hashed_ValidPass123!',
        status: 'LOCKED',
        failed_attempts: 5,
      });

      const request = createRequest({
        email: 'locked@example.com',
        password: 'ValidPass123!',
      });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        expect(response.status).toBe(401);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('ACCOUNT_LOCKED');
          expect(body.error.retriable).toBe(true);
          expect(body.error.retry_after).toBeDefined();
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should lock account after 5 failed attempts', async () => {
      const testName = 'account_lockout_after_failures';
      const startTime = Date.now();

      try {
        // Make 5 failed attempts
        for (let i = 0; i < 5; i++) {
          const request = createRequest({
            email: 'test@example.com',
            password: `WrongPass${i}!`,
          });
          await POST(request);
        }

        // Verify user is now locked
        const user = getUser('test@example.com');
        expect(user?.status).toBe('LOCKED');
        expect(user?.failed_attempts).toBe(5);

        // Next attempt should return ACCOUNT_LOCKED
        const request = createRequest({
          email: 'test@example.com',
          password: 'ValidPass123!',
        });
        const response = await POST(request);
        const body = await parseResponse<LoginResponse>(response);

        expect(response.status).toBe(401);
        if (!body.success) {
          expect(body.error.code).toBe('ACCOUNT_LOCKED');
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should return 401 for inactive account', async () => {
      const testName = 'invalid_credentials_account_inactive';
      const startTime = Date.now();

      // Seed inactive user
      seedUser({
        id: 'user_inactive',
        email: 'inactive@example.com',
        password_hash: 'hashed_ValidPass123!',
        status: 'INACTIVE',
        failed_attempts: 0,
      });

      const request = createRequest({
        email: 'inactive@example.com',
        password: 'ValidPass123!',
      });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        expect(response.status).toBe(401);
        expect(body.success).toBe(false);
        if (!body.success) {
          expect(body.error.code).toBe('ACCOUNT_INACTIVE');
          expect(body.error.retriable).toBe(false);
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });
  });

  // ==========================================================================
  // 4. SUCCESS (200)
  // ==========================================================================

  describe('Success (200)', () => {
    it('should return 200 with session for valid credentials', async () => {
      const testName = 'success_valid_credentials';
      const startTime = Date.now();

      const request = createRequest({
        email: 'test@example.com',
        password: 'ValidPass123!',
      });
      const response = await POST(request);
      const body = await parseResponse<LoginResponse>(response);

      try {
        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        if (body.success) {
          expect(body.data.session).toBeDefined();
          expect(body.data.session.id).toBeDefined();
          expect(body.data.session.user_id).toBe('user_123');
          expect(body.data.session.expires_at).toBeDefined();
          expect(body.data.access_token).toBeDefined();
          
          // Verify session expiry is in the future
          const expiresAt = new Date(body.data.session.expires_at);
          expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
        }

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should reset failed attempts on successful login', async () => {
      const testName = 'success_resets_failed_attempts';
      const startTime = Date.now();

      try {
        // Make 2 failed attempts first
        for (let i = 0; i < 2; i++) {
          const request = createRequest({
            email: 'test@example.com',
            password: `WrongPass${i}!`,
          });
          await POST(request);
        }

        // Verify failed attempts incremented
        let user = getUser('test@example.com');
        expect(user?.failed_attempts).toBe(2);

        // Successful login
        const request = createRequest({
          email: 'test@example.com',
          password: 'ValidPass123!',
        });
        const response = await POST(request);

        expect(response.status).toBe(200);

        // Verify failed attempts reset
        user = getUser('test@example.com');
        expect(user?.failed_attempts).toBe(0);

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });
  });

  // ==========================================================================
  // 5. PII PROTECTION
  // ==========================================================================

  describe('PII Protection - No Sensitive Data in Logs', () => {
    it('should NEVER log passwords', async () => {
      const testName = 'pii_no_password_logging';
      const startTime = Date.now();

      try {
        // Make requests that would trigger logging
        await POST(createRequest({
          email: 'test@example.com',
          password: 'MySecretPassword123!',
        }));

        await POST(createRequest({
          email: 'test@example.com',
          password: 'WrongPassword!',
        }));

        const logs = getCapturedLogs();
        const logsAsString = JSON.stringify(logs);

        // Passwords should never appear in logs
        expect(logsAsString).not.toContain('MySecretPassword123!');
        expect(logsAsString).not.toContain('WrongPassword!');
        expect(logsAsString).not.toContain('password');

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should redact email addresses in logs', async () => {
      const testName = 'pii_email_redaction';
      const startTime = Date.now();

      try {
        await POST(createRequest({
          email: 'sensitive.user@company.com',
          password: 'ValidPass123!',
        }));

        const logs = getCapturedLogs();
        const logsAsString = JSON.stringify(logs);

        // Full email should not appear
        expect(logsAsString).not.toContain('sensitive.user@company.com');
        
        // Redacted form should appear
        expect(logsAsString).toContain('s***@company.com');

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should redact IP addresses in logs', async () => {
      const testName = 'pii_ip_redaction';
      const startTime = Date.now();

      try {
        await POST(createRequest(
          {
            email: 'test@example.com',
            password: 'ValidPass123!',
          },
          { 'x-forwarded-for': '203.0.113.195' }
        ));

        const logs = getCapturedLogs();
        const logsAsString = JSON.stringify(logs);

        // Full IP should not appear
        expect(logsAsString).not.toContain('203.0.113.195');
        
        // Redacted form should appear
        expect(logsAsString).toContain('203.0.xxx.xxx');

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('should pass comprehensive PII assertion check', async () => {
      const testName = 'pii_comprehensive_check';
      const startTime = Date.now();

      try {
        // Make various requests
        await POST(createRequest({ email: 'user1@test.com', password: 'Pass1234!' }));
        await POST(createRequest({ email: 'user2@test.com', password: 'Wrong!' }));
        await POST(createRequest({ email: 'notfound@x.com', password: 'Test1234!' }));

        const logs = getCapturedLogs();
        const piiCheck = assertNoLoggedPII(logs);

        expect(piiCheck.safe).toBe(true);
        expect(piiCheck.violations).toHaveLength(0);

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });
  });

  // ==========================================================================
  // 6. SAFE LOGGING UTILITIES
  // ==========================================================================

  describe('Safe Logging Utilities', () => {
    it('redactPII should properly redact emails', () => {
      const testName = 'redactPII_email';
      const startTime = Date.now();

      try {
        expect(redactPII('john@example.com', 'email')).toBe('j***@example.com');
        expect(redactPII('a@b.co', 'email')).toBe('*@b.co');
        expect(redactPII('longname@domain.org', 'email')).toBe('l***@domain.org');

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });

    it('redactPII should properly redact IPs', () => {
      const testName = 'redactPII_ip';
      const startTime = Date.now();

      try {
        expect(redactPII('192.168.1.100', 'ip')).toBe('192.168.xxx.xxx');
        expect(redactPII('10.0.0.1', 'ip')).toBe('10.0.xxx.xxx');
        expect(redactPII('::1', 'ip')).toBe('xxx.xxx.xxx.xxx'); // IPv6 fallback

        proofBundle.tests.push({
          name: testName,
          status: 'passed',
          duration: Date.now() - startTime,
        });
        proofBundle.passed++;
      } catch (error) {
        proofBundle.tests.push({
          name: testName,
          status: 'failed',
          duration: Date.now() - startTime,
          error: String(error),
        });
        proofBundle.failed++;
        throw error;
      }
    });
  });
});
