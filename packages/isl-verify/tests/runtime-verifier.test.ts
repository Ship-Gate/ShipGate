/**
 * Tests for Runtime Verifier
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RuntimeVerifier } from '../src/runtime/runtime-verifier';
import type { Domain } from '@isl-lang/parser';
import type { EndpointSpec } from '../src/runtime/types';

describe('RuntimeVerifier', () => {
  let verifier: RuntimeVerifier;

  beforeEach(() => {
    verifier = new RuntimeVerifier();
  });

  describe('formatReport', () => {
    it('should format report when app fails to start', () => {
      const result = {
        appStarted: false,
        appStartTimeMs: 0,
        evidence: [],
        authTestsPassed: 0,
        authTestsTotal: 0,
        validationTestsPassed: 0,
        validationTestsTotal: 0,
        responseShapeTestsPassed: 0,
        responseShapeTestsTotal: 0,
        totalPassed: 0,
        totalTests: 0,
        errors: ['Failed to start: Port already in use'],
      };

      const report = verifier.formatReport(result);

      expect(report).toContain('❌ Application failed to start');
      expect(report).toContain('Failed to start: Port already in use');
    });

    it('should format report with successful verification', () => {
      const result = {
        appStarted: true,
        appStartTimeMs: 2500,
        evidence: [
          {
            endpoint: '/api/users',
            method: 'GET',
            testCase: 'missing_auth',
            request: { headers: {} },
            expectedStatus: 401,
            actualStatus: 401,
            responseBodyMatchesType: true,
            responseTime_ms: 45,
            passed: true,
            details: 'Expected 401, got 401',
          },
          {
            endpoint: '/api/users',
            method: 'POST',
            testCase: 'invalid_body_shape',
            request: { headers: {}, body: { wrong: 'shape' } },
            expectedStatus: 400,
            actualStatus: 400,
            responseBodyMatchesType: true,
            responseTime_ms: 32,
            passed: true,
            details: 'Expected 400, got 400',
          },
          {
            endpoint: '/api/users',
            method: 'GET',
            testCase: 'valid_request',
            request: { headers: { Authorization: 'Bearer token' } },
            expectedStatus: 200,
            actualStatus: 200,
            responseBodyMatchesType: true,
            responseTime_ms: 67,
            passed: true,
            details: 'Status and response shape match',
          },
        ],
        authTestsPassed: 1,
        authTestsTotal: 1,
        validationTestsPassed: 1,
        validationTestsTotal: 1,
        responseShapeTestsPassed: 1,
        responseShapeTestsTotal: 1,
        totalPassed: 3,
        totalTests: 3,
        errors: [],
      };

      const report = verifier.formatReport(result);

      expect(report).toContain('✓ Application started in 2500ms');
      expect(report).toContain('✓ Auth Tests: 1/1 passed');
      expect(report).toContain('✓ Validation Tests: 1/1 passed');
      expect(report).toContain('✓ Response Shape Tests: 1/1 passed');
      expect(report).toContain('Total: 3/3 tests passed');
    });

    it('should show failed tests', () => {
      const result = {
        appStarted: true,
        appStartTimeMs: 1500,
        evidence: [
          {
            endpoint: '/api/users',
            method: 'GET',
            testCase: 'missing_auth',
            request: { headers: {} },
            expectedStatus: 401,
            actualStatus: 200,
            responseBodyMatchesType: false,
            responseTime_ms: 45,
            passed: false,
            details: 'Expected 401, got 200',
          },
        ],
        authTestsPassed: 0,
        authTestsTotal: 1,
        validationTestsPassed: 0,
        validationTestsTotal: 0,
        responseShapeTestsPassed: 0,
        responseShapeTestsTotal: 0,
        totalPassed: 0,
        totalTests: 1,
        errors: [],
      };

      const report = verifier.formatReport(result);

      expect(report).toContain('✗ Auth Tests: 0/1 passed');
      expect(report).toContain('Failed Tests:');
      expect(report).toContain('GET /api/users [missing_auth]');
      expect(report).toContain('Expected 401, got 200');
    });
  });
});

describe('RequestGenerator', () => {
  it('should generate valid request', async () => {
    const { RequestGenerator } = await import('../src/runtime/request-generator');
    const generator = new RequestGenerator();

    const spec: EndpointSpec = {
      path: '/api/users',
      method: 'POST',
      auth: 'required',
      requestBody: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
          password: { type: 'string', minLength: 8 },
        },
      },
    };

    const requests = generator.generateTestRequests(spec, 'test-token');

    const validRequest = requests.find(r => r.testCase === 'valid_request');
    expect(validRequest).toBeDefined();
    expect(validRequest?.headers.Authorization).toBe('Bearer test-token');
    expect(validRequest?.body).toBeDefined();
    expect((validRequest?.body as any).email).toContain('@');
    expect((validRequest?.body as any).password).toBeDefined();
  });

  it('should generate missing auth test', async () => {
    const { RequestGenerator } = await import('../src/runtime/request-generator');
    const generator = new RequestGenerator();

    const spec: EndpointSpec = {
      path: '/api/users',
      method: 'GET',
      auth: 'required',
    };

    const requests = generator.generateTestRequests(spec, 'test-token');

    const missingAuth = requests.find(r => r.testCase === 'missing_auth');
    expect(missingAuth).toBeDefined();
    expect(missingAuth?.expectedStatus).toBe(401);
    expect(missingAuth?.headers.Authorization).toBeUndefined();
  });

  it('should generate missing required field tests', async () => {
    const { RequestGenerator } = await import('../src/runtime/request-generator');
    const generator = new RequestGenerator();

    const spec: EndpointSpec = {
      path: '/api/users',
      method: 'POST',
      auth: 'none',
      requestBody: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string' },
          password: { type: 'string' },
        },
      },
    };

    const requests = generator.generateTestRequests(spec);

    const missingEmail = requests.find(r => r.testCase === 'missing_required_field_email');
    const missingPassword = requests.find(r => r.testCase === 'missing_required_field_password');

    expect(missingEmail).toBeDefined();
    expect(missingPassword).toBeDefined();
    expect(missingEmail?.expectedStatus).toBe(400);
    expect((missingEmail?.body as any).email).toBeUndefined();
    expect((missingEmail?.body as any).password).toBeDefined();
  });
});

describe('ResponseValidator', () => {
  it('should validate matching response', async () => {
    const { ResponseValidator } = await import('../src/runtime/response-validator');
    const validator = new ResponseValidator();

    const response = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
    };

    const shape = {
      type: 'object' as const,
      required: ['id', 'email'],
      properties: {
        id: { type: 'number' as const },
        email: { type: 'string' as const },
        name: { type: 'string' as const },
      },
    };

    const result = validator.validateResponse(response, shape);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should detect missing required fields', async () => {
    const { ResponseValidator } = await import('../src/runtime/response-validator');
    const validator = new ResponseValidator();

    const response = {
      id: 1,
    };

    const shape = {
      type: 'object' as const,
      required: ['id', 'email'],
      properties: {
        id: { type: 'number' as const },
        email: { type: 'string' as const },
      },
    };

    const result = validator.validateResponse(response, shape);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('email'))).toBe(true);
  });

  it('should detect extra fields (data leaks)', async () => {
    const { ResponseValidator } = await import('../src/runtime/response-validator');
    const validator = new ResponseValidator();

    const response = {
      id: 1,
      email: 'test@example.com',
      passwordHash: 'secret123',
    };

    const shape = {
      type: 'object' as const,
      required: ['id', 'email'],
      properties: {
        id: { type: 'number' as const },
        email: { type: 'string' as const },
      },
    };

    const result = validator.validateResponse(response, shape);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('passwordHash'))).toBe(true);
  });

  it('should detect leaked sensitive data', async () => {
    const { ResponseValidator } = await import('../src/runtime/response-validator');
    const validator = new ResponseValidator();

    const response = {
      user: {
        id: 1,
        email: 'test@example.com',
        passwordHash: '$2a$10$...',
      },
    };

    const leaks = validator.checkForLeakedData(response);

    expect(leaks.length).toBeGreaterThan(0);
    expect(leaks.some(l => l.includes('passwordHash'))).toBe(true);
  });
});

describe('Runtime to Proof Conversion', () => {
  it('should convert successful runtime results to proofs', async () => {
    const { convertRuntimeToProofs } = await import('../src/runtime/runtime-to-proof');

    const runtimeResult = {
      appStarted: true,
      appStartTimeMs: 2000,
      evidence: [
        {
          endpoint: '/api/users',
          method: 'GET',
          testCase: 'missing_auth',
          request: { headers: {} },
          expectedStatus: 401,
          actualStatus: 401,
          responseBodyMatchesType: true,
          responseTime_ms: 45,
          passed: true,
          details: 'Expected 401, got 401',
        },
      ],
      authTestsPassed: 1,
      authTestsTotal: 1,
      validationTestsPassed: 0,
      validationTestsTotal: 0,
      responseShapeTestsPassed: 0,
      responseShapeTestsTotal: 0,
      totalPassed: 1,
      totalTests: 1,
      errors: [],
    };

    const proofs = convertRuntimeToProofs(runtimeResult);

    const authProof = proofs.find(p => p.property === 'runtime-auth-blocking');
    expect(authProof).toBeDefined();
    expect(authProof?.verdict).toBe('PROVEN');
    expect(authProof?.confidence).toBe(1);
  });

  it('should mark properties as NOT_VERIFIED when no tests run', async () => {
    const { convertRuntimeToProofs } = await import('../src/runtime/runtime-to-proof');

    const runtimeResult = {
      appStarted: false,
      appStartTimeMs: 0,
      evidence: [],
      authTestsPassed: 0,
      authTestsTotal: 0,
      validationTestsPassed: 0,
      validationTestsTotal: 0,
      responseShapeTestsPassed: 0,
      responseShapeTestsTotal: 0,
      totalPassed: 0,
      totalTests: 0,
      errors: ['App failed to start'],
    };

    const proofs = convertRuntimeToProofs(runtimeResult);

    expect(proofs.every(p => p.verdict === 'NOT_VERIFIED')).toBe(true);
  });
});
