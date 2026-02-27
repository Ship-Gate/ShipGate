/**
 * Trace Format Tests
 * 
 * Ensures stable schema, proper redaction, and Login clause verification support.
 */

import { describe, it, expect } from 'vitest';
import {
  TraceEmitter,
  createTraceEmitter,
  validateTraceEvent,
  validateTrace,
  isValidTraceEvent,
  isValidTrace,
  sanitizeInputs,
  sanitizeOutputs,
  sanitizeError,
  redactHeaders,
  redactTraceData,
  containsSensitiveData,
  detectSensitivePatterns,
  partialMaskEmail,
  partialMaskId,
  REDACTED_FIELDS,
  ALWAYS_REDACTED_FIELDS,
  PII_FIELDS,
  ALL_EVENT_KINDS,
  LOGIN_EVENT_KINDS,
} from '../src/index.js';
import {
  sampleTrace,
  sampleHandlerCallEvent,
  sampleFailingTrace,
  sampleNestedTrace,
  sampleHealerIterationTrace,
  // Login fixtures
  sampleRateLimitCheckedEvent,
  sampleRateLimitExceededEvent,
  sampleAuditWrittenEvent,
  sampleSessionCreatedEvent,
  sampleUserUpdatedEvent,
  sampleErrorReturnedEvent,
  loginSuccessTrace,
  loginInvalidCredentialsTrace,
  loginRateLimitedTrace,
} from '../src/fixtures.js';

describe('Trace Format', () => {
  describe('Schema Validation', () => {
    it('should validate a valid trace event', () => {
      const result = validateTraceEvent(sampleHandlerCallEvent);
      expect(result.valid).toBe(true);
    });

    it('should validate a complete trace', () => {
      const result = validateTrace(sampleTrace);
      expect(result.valid).toBe(true);
    });

    it('should reject trace event with missing required fields', () => {
      const invalid = {
        time: '2026-02-02T10:00:00.000Z',
        kind: 'handler_call',
        // Missing correlationId, handler, inputs, outputs, events
      };
      const result = validateTraceEvent(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });

    it('should reject trace with invalid event', () => {
      const invalid = {
        id: 'trace-123',
        name: 'Test',
        domain: 'test',
        startTime: '2026-02-02T10:00:00.000Z',
        correlationId: 'corr-123',
        events: [
          {
            time: '2026-02-02T10:00:00.000Z',
            // Missing required fields
          },
        ],
      };
      const result = validateTrace(invalid);
      expect(result.valid).toBe(false);
    });

    it('should validate type guards', () => {
      expect(isValidTraceEvent(sampleHandlerCallEvent)).toBe(true);
      expect(isValidTrace(sampleTrace)).toBe(true);
      expect(isValidTraceEvent(null)).toBe(false);
      expect(isValidTrace({})).toBe(false);
    });

    it('should accept all valid event kinds', () => {
      for (const kind of ALL_EVENT_KINDS) {
        const event = {
          time: '2026-02-02T10:00:00.000Z',
          kind,
          correlationId: 'test-123',
          handler: 'testHandler',
          inputs: {},
          outputs: {},
          events: [],
        };
        const result = validateTraceEvent(event);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject invalid event kinds', () => {
      const event = {
        time: '2026-02-02T10:00:00.000Z',
        kind: 'invalid_kind',
        correlationId: 'test-123',
        handler: 'testHandler',
        inputs: {},
        outputs: {},
        events: [],
      };
      const result = validateTraceEvent(event);
      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // Login Event Validation
  // ============================================================================

  describe('Login Event Validation', () => {
    it('should validate rate_limit_checked event', () => {
      const result = validateTraceEvent(sampleRateLimitCheckedEvent);
      expect(result.valid).toBe(true);
      expect(sampleRateLimitCheckedEvent.kind).toBe('rate_limit_checked');
    });

    it('should validate audit_written event', () => {
      const result = validateTraceEvent(sampleAuditWrittenEvent);
      expect(result.valid).toBe(true);
      expect(sampleAuditWrittenEvent.kind).toBe('audit_written');
    });

    it('should validate session_created event', () => {
      const result = validateTraceEvent(sampleSessionCreatedEvent);
      expect(result.valid).toBe(true);
      expect(sampleSessionCreatedEvent.kind).toBe('session_created');
    });

    it('should validate user_updated event', () => {
      const result = validateTraceEvent(sampleUserUpdatedEvent);
      expect(result.valid).toBe(true);
      expect(sampleUserUpdatedEvent.kind).toBe('user_updated');
    });

    it('should validate error_returned event', () => {
      const result = validateTraceEvent(sampleErrorReturnedEvent);
      expect(result.valid).toBe(true);
      expect(sampleErrorReturnedEvent.kind).toBe('error_returned');
    });

    it('should have all login event kinds defined', () => {
      expect(LOGIN_EVENT_KINDS).toContain('rate_limit_checked');
      expect(LOGIN_EVENT_KINDS).toContain('audit_written');
      expect(LOGIN_EVENT_KINDS).toContain('session_created');
      expect(LOGIN_EVENT_KINDS).toContain('user_updated');
      expect(LOGIN_EVENT_KINDS).toContain('error_returned');
    });
  });

  // ============================================================================
  // Login Trace Validation
  // ============================================================================

  describe('Login Trace Validation', () => {
    it('should validate login success trace', () => {
      const result = validateTrace(loginSuccessTrace);
      expect(result.valid).toBe(true);
      expect(loginSuccessTrace.metadata?.auth?.outcome).toBe('success');
    });

    it('should validate login invalid credentials trace', () => {
      const result = validateTrace(loginInvalidCredentialsTrace);
      expect(result.valid).toBe(true);
      expect(loginInvalidCredentialsTrace.metadata?.auth?.outcome).toBe('invalid_credentials');
    });

    it('should validate login rate limited trace', () => {
      const result = validateTrace(loginRateLimitedTrace);
      expect(result.valid).toBe(true);
      expect(loginRateLimitedTrace.metadata?.auth?.outcome).toBe('rate_limited');
    });

    it('login success trace should contain required events', () => {
      const eventKinds = loginSuccessTrace.events.map(e => e.kind);
      expect(eventKinds).toContain('handler_call');
      expect(eventKinds).toContain('rate_limit_checked');
      expect(eventKinds).toContain('session_created');
      expect(eventKinds).toContain('audit_written');
      expect(eventKinds).toContain('handler_return');
    });

    it('login failure trace should contain error events', () => {
      const eventKinds = loginInvalidCredentialsTrace.events.map(e => e.kind);
      expect(eventKinds).toContain('handler_call');
      expect(eventKinds).toContain('rate_limit_checked');
      expect(eventKinds).toContain('audit_written');
      expect(eventKinds).toContain('error_returned');
      expect(eventKinds).toContain('handler_error');
    });
  });

  // ============================================================================
  // Redaction Tests
  // ============================================================================

  describe('Redaction', () => {
    it('should redact email from inputs', () => {
      const inputs = {
        email: 'user@example.com',
        name: 'John Doe',
      };
      const sanitized = sanitizeInputs(inputs);
      // Email field is in PII_FIELDS, value gets pattern-matched to [EMAIL_REDACTED]
      expect(sanitized.email).toBe('[EMAIL_REDACTED]');
      expect(sanitized.name).toBe('John Doe');
    });

    it('should redact password from inputs', () => {
      const inputs = {
        password: 'secret123',
        username: 'john',
      };
      const sanitized = sanitizeInputs(inputs);
      // Password field is in ALWAYS_REDACTED_FIELDS
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.username).toBe('john');
    });

    it('should redact token from inputs', () => {
      const inputs = {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        userId: '123',
      };
      const sanitized = sanitizeInputs(inputs);
      // accessToken field is in ALWAYS_REDACTED_FIELDS
      expect(sanitized.accessToken).toBe('[REDACTED]');
      expect(sanitized.userId).toBe('123');
    });

    it('should redact headers', () => {
      const headers = {
        'authorization': 'Bearer token123',
        'cookie': 'session=abc123',
        'x-api-key': 'sk-1234567890',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
      };
      const redacted = redactHeaders(headers);
      expect(redacted['authorization']).toBe('[REDACTED]');
      expect(redacted['cookie']).toBe('[REDACTED]');
      expect(redacted['x-api-key']).toBe('[REDACTED]');
      expect(redacted['content-type']).toBe('application/json');
      // user-agent doesn't match PII patterns, so it's not redacted
      expect(redacted['user-agent']).toBe('Mozilla/5.0');
    });

    it('should sanitize error', () => {
      const error = new Error('User email: user@example.com');
      const sanitized = sanitizeError(error);
      expect(sanitized.message).not.toContain('user@example.com');
      expect(sanitized.message).toContain('[EMAIL_REDACTED]');
    });

    it('should sanitize outputs', () => {
      const outputs = {
        result: {
          id: '123',
          email: 'user@example.com',
          name: 'John',
        },
      };
      const sanitized = sanitizeOutputs(outputs);
      // Email value gets pattern-matched to [EMAIL_REDACTED]
      expect((sanitized.result as Record<string, unknown>).email).toBe('[EMAIL_REDACTED]');
      expect((sanitized.result as Record<string, unknown>).name).toBe('John');
    });
  });

  // ============================================================================
  // Redaction Correctness Tests (Hard)
  // ============================================================================

  describe('Redaction Correctness', () => {
    describe('Password Redaction', () => {
      it('should redact all password field variations', () => {
        const inputs = {
          password: 'secret',
          passwd: 'secret',
          pwd: 'secret',
          newPassword: 'secret',
          oldPassword: 'secret',
          confirmPassword: 'secret',
          currentPassword: 'secret',
          passwordHash: 'hash',
          hashedPassword: 'hash',
        };
        const sanitized = sanitizeInputs(inputs);
        
        for (const key of Object.keys(inputs)) {
          expect(sanitized[key]).toBe('[REDACTED]');
        }
      });

      it('should not redact "passed" as password', () => {
        // "passed" should NOT match "pass" pattern
        const inputs = {
          passed: true,
          passing: 'yes',
        };
        const sanitized = sanitizeInputs(inputs);
        expect(sanitized.passed).toBe(true);
        expect(sanitized.passing).toBe('yes');
      });

      it('should redact password in nested objects', () => {
        const inputs = {
          user: {
            credentials: {
              password: 'secret123',
            },
          },
        };
        const sanitized = sanitizeInputs(inputs);
        // The 'credentials' object is redacted because it matches a sensitive field pattern
        // So we need to check the whole nested structure
        const user = sanitized.user as Record<string, unknown>;
        // 'credentials' matches the 'credential' pattern in ALWAYS_REDACTED_FIELDS
        // So the whole credentials object might be redacted
        if (user.credentials === '[REDACTED]') {
          // The credentials object was redacted due to field name matching
          expect(user.credentials).toBe('[REDACTED]');
        } else {
          // If credentials object wasn't redacted, check the password field
          const credentials = user.credentials as Record<string, unknown>;
          expect(credentials.password).toBe('[REDACTED]');
        }
      });
    });

    describe('Token Redaction', () => {
      it('should redact JWT tokens in strings', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
        const sanitized = redactTraceData({ message: `Token: ${jwt}` });
        expect(sanitized.message).not.toContain('eyJ');
        expect(sanitized.message).toContain('[JWT_REDACTED]');
      });

      it('should redact Bearer tokens', () => {
        const sanitized = redactTraceData({ auth: 'Bearer abc123def456ghi789' });
        expect(sanitized.auth).toContain('[BEARER_REDACTED]');
      });

      it('should redact Stripe keys in values', () => {
        // Use field name that won't match ALWAYS_REDACTED_FIELDS
        const sanitized = redactTraceData({ 
          message: 'API key: sk_live_1234567890abcdefghij' 
        });
        expect(sanitized.message).toContain('[STRIPE_KEY_REDACTED]');
      });

      it('should redact AWS keys in values', () => {
        const sanitized = redactTraceData({ 
          info: 'Access key: AKIAIOSFODNN7EXAMPLE' 
        });
        expect(sanitized.info).toContain('[AWS_KEY_REDACTED]');
      });

      it('should redact field named "key"', () => {
        // Field name "key" is in ALWAYS_REDACTED_FIELDS
        const sanitized = redactTraceData({ 
          key: 'sk_live_1234567890abcdefghij' 
        });
        expect(sanitized.key).toBe('[REDACTED]');
      });

      it('should redact GitHub tokens', () => {
        const sanitized = redactTraceData({ 
          token: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' 
        });
        expect(sanitized.token).toBe('[REDACTED]'); // Field name matched
      });
    });

    describe('PII Redaction', () => {
      it('should redact email addresses', () => {
        const sanitized = redactTraceData({ 
          message: 'Contact user@example.com for support' 
        });
        expect(sanitized.message).not.toContain('user@example.com');
        expect(sanitized.message).toContain('[EMAIL_REDACTED]');
      });

      it('should redact SSN', () => {
        const sanitized = redactTraceData({ 
          message: 'SSN: 123-45-6789' 
        });
        expect(sanitized.message).not.toContain('123-45-6789');
        expect(sanitized.message).toContain('[SSN_REDACTED]');
      });

      it('should redact credit card numbers', () => {
        const sanitized = redactTraceData({ 
          message: 'Card: 4111-1111-1111-1111' 
        });
        expect(sanitized.message).not.toContain('4111');
        expect(sanitized.message).toContain('[CARD_REDACTED]');
      });

      it('should redact phone numbers', () => {
        const sanitized = redactTraceData({ 
          message: 'Call +1 (555) 123-4567' 
        });
        expect(sanitized.message).not.toContain('555');
        expect(sanitized.message).toContain('[PHONE_REDACTED]');
      });

      it('should redact IP addresses', () => {
        const sanitized = redactTraceData({ 
          message: 'Request from 192.168.1.100' 
        });
        expect(sanitized.message).not.toContain('192.168.1.100');
        expect(sanitized.message).toContain('[IP_REDACTED]');
      });
    });

    describe('Pattern Detection', () => {
      it('containsSensitiveData should detect emails', () => {
        expect(containsSensitiveData('user@example.com')).toBe(true);
        expect(containsSensitiveData('no email here')).toBe(false);
      });

      it('containsSensitiveData should detect JWTs', () => {
        const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
        expect(containsSensitiveData(jwt)).toBe(true);
      });

      it('detectSensitivePatterns should return pattern names', () => {
        const patterns = detectSensitivePatterns('user@example.com 192.168.1.1');
        expect(patterns).toContain('email');
        expect(patterns).toContain('ipv4');
      });
    });

    describe('Partial Masking', () => {
      it('should partially mask emails', () => {
        expect(partialMaskEmail('john@example.com')).toBe('j***@example.com');
        expect(partialMaskEmail('ab@example.com')).toBe('a***@example.com');
      });

      it('should partially mask IDs', () => {
        expect(partialMaskId('1234567890abcdef')).toBe('1234********cdef');
        expect(partialMaskId('short')).toBe('[REDACTED]');
      });
    });

    describe('No PII in Login Traces', () => {
      it('login success trace should not contain raw passwords', () => {
        const traceJson = JSON.stringify(loginSuccessTrace);
        expect(traceJson).not.toMatch(/password"?\s*:\s*"[^[]/); // No raw password values
        expect(traceJson).not.toMatch(/secret123|mypassword|pass123/i);
      });

      it('login success trace should not contain raw tokens', () => {
        const traceJson = JSON.stringify(loginSuccessTrace);
        expect(traceJson).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/); // No raw JWTs
        expect(traceJson).toContain('[JWT_REDACTED]');
      });

      it('login traces should contain redaction markers', () => {
        const successJson = JSON.stringify(loginSuccessTrace);
        const failureJson = JSON.stringify(loginInvalidCredentialsTrace);
        
        // Should have redaction markers
        expect(successJson).toContain('[EMAIL_REDACTED]');
        expect(successJson).toContain('[REDACTED]');
        expect(failureJson).toContain('[EMAIL_REDACTED]');
        expect(failureJson).toContain('[REDACTED]');
      });
    });
  });

  // ============================================================================
  // TraceEmitter Tests
  // ============================================================================

  describe('TraceEmitter', () => {
    it('should create a trace emitter', () => {
      const emitter = createTraceEmitter();
      expect(emitter).toBeInstanceOf(TraceEmitter);
      expect(emitter.getCorrelationId()).toBeDefined();
    });

    it('should emit handler call event', () => {
      const emitter = createTraceEmitter({ domain: 'auth' });
      const event = emitter.emitHandlerCall('createUser', {
        email: 'user@example.com',
        name: 'John',
      });
      
      expect(event.kind).toBe('handler_call');
      expect(event.handler).toBe('createUser');
      // Email value is pattern-matched to [EMAIL_REDACTED]
      expect(event.inputs.email).toBe('[EMAIL_REDACTED]');
      expect(event.inputs.name).toBe('John');
      expect(event.correlationId).toBeDefined();
    });

    it('should emit handler return event', () => {
      const emitter = createTraceEmitter();
      const event = emitter.emitHandlerReturn(
        'createUser',
        { name: 'John' },
        { id: '123', email: '[REDACTED]' },
        1000
      );
      
      expect(event.kind).toBe('handler_return');
      expect(event.outputs.result).toBeDefined();
      expect(event.outputs.duration).toBe(1000);
    });

    it('should emit handler error event', () => {
      const emitter = createTraceEmitter();
      const error = new Error('Failed to create user');
      const event = emitter.emitHandlerError('createUser', {}, error);
      
      expect(event.kind).toBe('handler_error');
      expect(event.outputs.error).toBeDefined();
      expect(event.outputs.error.name).toBe('Error');
      expect(event.outputs.error.message).toBe('Failed to create user');
    });

    it('should emit state change event', () => {
      const emitter = createTraceEmitter();
      const event = emitter.emitStateChange(
        'updateBalance',
        ['account', 'balance'],
        1000,
        2000,
        'processPayment'
      );
      
      expect(event.kind).toBe('state_change');
      expect(event.inputs.path).toEqual(['account', 'balance']);
      expect(event.inputs.oldValue).toBe(1000);
      expect(event.outputs.newValue).toBe(2000);
      expect(event.outputs.source).toBe('processPayment');
    });

    it('should emit check event', () => {
      const emitter = createTraceEmitter();
      const event = emitter.emitCheck(
        'createUser',
        'email is valid',
        true,
        'precondition'
      );
      
      expect(event.kind).toBe('check');
      expect(event.inputs.expression).toBe('email is valid');
      expect(event.outputs.passed).toBe(true);
      expect(event.outputs.category).toBe('precondition');
    });

    it('should build a complete trace', () => {
      const emitter = createTraceEmitter({ domain: 'auth' });
      emitter.emitHandlerCall('createUser', { name: 'John' });
      emitter.emitHandlerReturn('createUser', {}, { id: '123' }, 1000);
      
      const trace = emitter.buildTrace('User Creation Test', {
        testName: 'test_create_user',
        passed: true,
      });
      
      expect(trace.id).toBeDefined();
      expect(trace.name).toBe('User Creation Test');
      expect(trace.domain).toBe('auth');
      expect(trace.events.length).toBe(2);
      expect(trace.metadata?.testName).toBe('test_create_user');
      expect(trace.metadata?.passed).toBe(true);
      // Duration may be 0 if test runs too fast
      expect(trace.metadata?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should export trace as JSON', () => {
      const emitter = createTraceEmitter();
      emitter.emitHandlerCall('test', {});
      const json = emitter.exportTrace('Test Trace');
      
      expect(() => JSON.parse(json)).not.toThrow();
      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('Test Trace');
      expect(Array.isArray(parsed.events)).toBe(true);
    });

    it('should handle nested events', () => {
      const emitter = createTraceEmitter();
      const nestedEvents = [
        emitter.emitCheck('validate', 'x > 0', true, 'precondition'),
        emitter.emitStateChange('update', ['x'], 0, 1, 'validate'),
      ];
      emitter.emitNested('process', nestedEvents);
      
      const events = emitter.getEvents();
      expect(events.length).toBe(3);
      const nested = events.find(e => e.kind === 'nested');
      expect(nested).toBeDefined();
      expect(nested!.events.length).toBe(2);
    });

    it('should clear events', () => {
      const emitter = createTraceEmitter();
      emitter.emitHandlerCall('test', {});
      expect(emitter.getEvents().length).toBe(1);
      
      emitter.clear();
      expect(emitter.getEvents().length).toBe(0);
    });

    it('should use custom correlation ID', () => {
      const emitter = createTraceEmitter({ correlationId: 'custom-123' });
      expect(emitter.getCorrelationId()).toBe('custom-123');
      
      emitter.setCorrelationId('custom-456');
      expect(emitter.getCorrelationId()).toBe('custom-456');
    });
  });

  // ============================================================================
  // Login Event Emitter Tests
  // ============================================================================

  describe('Login Event Emitters', () => {
    it('should emit rate limit checked event', () => {
      const emitter = createTraceEmitter({ domain: 'auth' });
      const event = emitter.emitRateLimitChecked(
        'Login',
        '192.168.1.1', // This should be redacted
        'ip',
        5,
        300,
        {
          allowed: true,
          currentCount: 1,
          remaining: 4,
          resetInSeconds: 300,
        }
      );
      
      expect(event.kind).toBe('rate_limit_checked');
      expect(event.inputs.identifier).toBe('[IDENTIFIER_HASH]'); // Should be redacted
      expect(event.inputs.identifierType).toBe('ip');
      expect(event.inputs.limit).toBe(5);
      expect(event.outputs.allowed).toBe(true);
      expect(event.outputs.exceeded).toBe(false);
      expect(event.timing).toBeDefined();
    });

    it('should emit audit written event', () => {
      const emitter = createTraceEmitter({ domain: 'auth' });
      const event = emitter.emitAuditWritten(
        'Login',
        'login_success',
        {
          success: true,
          auditId: 'audit_123',
          destination: 'database',
        },
        'user_123', // Should be redacted
        'session_456' // Should be redacted
      );
      
      expect(event.kind).toBe('audit_written');
      expect(event.inputs.action).toBe('login_success');
      expect(event.inputs.actorId).toBe('user_[REDACTED]');
      expect(event.outputs.success).toBe(true);
      expect(event.outputs.auditId).toBe('audit_123');
    });

    it('should emit session created event', () => {
      const emitter = createTraceEmitter({ domain: 'auth' });
      const event = emitter.emitSessionCreated(
        'Login',
        'user_123', // Should be redacted
        'access_token',
        {
          sessionId: 'sess_abcd1234efgh5678', // Should be partially masked
          tokenType: 'jwt',
          expiresAt: '2026-02-02T11:00:00.000Z',
        },
        ['read', 'write']
      );
      
      expect(event.kind).toBe('session_created');
      expect(event.inputs.userId).toBe('user_[REDACTED]');
      expect(event.outputs.sessionId).toMatch(/^sess\*{4,}5678$/);
      expect(event.outputs.tokenType).toBe('jwt');
    });

    it('should emit user updated event', () => {
      const emitter = createTraceEmitter({ domain: 'auth' });
      const event = emitter.emitUserUpdated(
        'Login',
        'user_123', // Should be redacted
        ['lastLoginAt', 'loginCount'],
        'login',
        {
          success: true,
          changedFields: ['lastLoginAt', 'loginCount'],
        }
      );
      
      expect(event.kind).toBe('user_updated');
      expect(event.inputs.userId).toBe('user_[REDACTED]');
      expect(event.inputs.fields).toEqual(['lastLoginAt', 'loginCount']);
      expect(event.inputs.reason).toBe('login');
      expect(event.outputs.success).toBe(true);
    });

    it('should emit error returned event', () => {
      const emitter = createTraceEmitter({ domain: 'auth' });
      const event = emitter.emitErrorReturned(
        'Login',
        {
          name: 'AuthenticationError',
          code: 'INVALID_CREDENTIALS',
          message: 'User user@example.com not found', // PII in internal message
        },
        'credential_verification',
        {
          statusCode: 401,
          errorCode: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password', // Safe public message
          errorType: 'auth',
          retry: { allowed: true },
        }
      );
      
      expect(event.kind).toBe('error_returned');
      expect(event.inputs.error.name).toBe('AuthenticationError');
      expect(event.inputs.error.code).toBe('INVALID_CREDENTIALS');
      // Internal message with PII should not be included
      expect(event.inputs.error).not.toHaveProperty('message');
      expect(event.outputs.statusCode).toBe(401);
      expect(event.outputs.message).toBe('Invalid email or password');
    });

    it('should create complete login trace with emitter', () => {
      const emitter = createTraceEmitter({ domain: 'auth', correlationId: 'login-test' });
      
      // 1. Handler call
      emitter.emitHandlerCall('Login', {
        email: 'user@example.com',
        password: 'secret123',
      });
      
      // 2. Rate limit check
      emitter.emitRateLimitChecked(
        'Login',
        'ip-hash',
        'ip',
        5,
        300,
        { allowed: true, currentCount: 1, remaining: 4, resetInSeconds: 300 }
      );
      
      // 3. Credential check
      emitter.emitCheck('Login', 'credentials.valid', true, 'precondition');
      
      // 4. Session creation
      emitter.emitSessionCreated(
        'Login',
        'user_123',
        'access_token',
        {
          sessionId: 'sess_12345678901234567890',
          tokenType: 'jwt',
          expiresAt: new Date(Date.now() + 3600000),
        }
      );
      
      // 5. User update
      emitter.emitUserUpdated(
        'Login',
        'user_123',
        ['lastLoginAt'],
        'login',
        { success: true }
      );
      
      // 6. Audit write
      emitter.emitAuditWritten(
        'Login',
        'login_success',
        { success: true, auditId: 'audit_123' },
        'user_123'
      );
      
      // 7. Handler return
      emitter.emitHandlerReturn('Login', {}, { success: true }, 500);
      
      const trace = emitter.buildTrace('Login Success Test', {
        auth: {
          outcome: 'success',
          userIdHash: 'sha256_xxx',
          mfaRequired: false,
          mfaCompleted: false,
          recentFailedAttempts: 0,
          accountLocked: false,
        },
      });
      
      // Validate trace
      const result = validateTrace(trace);
      expect(result.valid).toBe(true);
      
      // Check event sequence
      const eventKinds = trace.events.map(e => e.kind);
      expect(eventKinds).toContain('handler_call');
      expect(eventKinds).toContain('rate_limit_checked');
      expect(eventKinds).toContain('check');
      expect(eventKinds).toContain('session_created');
      expect(eventKinds).toContain('user_updated');
      expect(eventKinds).toContain('audit_written');
      expect(eventKinds).toContain('handler_return');
      
      // Check no raw PII leaked (redaction markers are OK)
      const traceJson = JSON.stringify(trace);
      // Email should be redacted (either to [EMAIL_REDACTED] or [REDACTED])
      expect(traceJson).not.toMatch(/@example\.com/);
      // Password should be redacted
      expect(traceJson).not.toMatch(/"password"\s*:\s*"[^[]/);
    });
  });

  // ============================================================================
  // Timing Tests
  // ============================================================================

  describe('Timing', () => {
    it('should include timing info in events', () => {
      const emitter = createTraceEmitter();
      const event = emitter.emitHandlerCall('test', {});
      
      expect(event.timing).toBeDefined();
      expect(event.timing?.startMs).toBeGreaterThan(0);
      expect(event.timing?.sequence).toBe(0);
    });

    it('should increment sequence numbers', () => {
      const emitter = createTraceEmitter();
      const event1 = emitter.emitHandlerCall('test1', {});
      const event2 = emitter.emitHandlerCall('test2', {});
      const event3 = emitter.emitHandlerCall('test3', {});
      
      expect(event1.timing?.sequence).toBe(0);
      expect(event2.timing?.sequence).toBe(1);
      expect(event3.timing?.sequence).toBe(2);
    });

    it('should reset sequence on clear', () => {
      const emitter = createTraceEmitter();
      emitter.emitHandlerCall('test1', {});
      emitter.emitHandlerCall('test2', {});
      emitter.clear();
      
      const event = emitter.emitHandlerCall('test3', {});
      expect(event.timing?.sequence).toBe(0);
    });

    it('should not include timing when disabled', () => {
      const emitter = createTraceEmitter({ captureTiming: false });
      const event = emitter.emitHandlerCall('test', {});
      
      expect(event.timing).toBeUndefined();
    });
  });

  // ============================================================================
  // Fixture Validation
  // ============================================================================

  describe('Fixture Validation', () => {
    it('should validate sample trace', () => {
      const result = validateTrace(sampleTrace);
      expect(result.valid).toBe(true);
    });

    it('should validate nested trace', () => {
      const result = validateTrace(sampleNestedTrace);
      if (!result.valid) {
        console.error('Nested trace validation errors:', result.errors);
      }
      expect(result.valid).toBe(true);
    });

    it('should validate failing trace', () => {
      const result = validateTrace(sampleFailingTrace);
      expect(result.valid).toBe(true);
    });

    it('should validate healer iteration trace', () => {
      const result = validateTrace(sampleHealerIterationTrace);
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // Schema Stability Tests
  // ============================================================================

  describe('Schema Stability', () => {
    it('should maintain consistent event structure', () => {
      const emitter = createTraceEmitter();
      const event1 = emitter.emitHandlerCall('handler1', {});
      const event2 = emitter.emitHandlerCall('handler2', {});
      
      // Both events should have the same structure
      expect(Object.keys(event1).sort()).toEqual(Object.keys(event2).sort());
      expect(event1.kind).toBe(event2.kind);
      expect(typeof event1.time).toBe(typeof event2.time);
      expect(typeof event1.correlationId).toBe(typeof event2.correlationId);
    });

    it('should serialize and deserialize consistently', () => {
      const emitter = createTraceEmitter();
      emitter.emitHandlerCall('test', { x: 1 });
      emitter.emitHandlerReturn('test', {}, { y: 2 }, 100);
      
      const json = emitter.exportTrace('Test');
      const parsed = JSON.parse(json);
      
      // Should validate after round-trip
      const result = validateTrace(parsed);
      expect(result.valid).toBe(true);
      
      // Should have same structure
      expect(parsed.events.length).toBe(2);
      expect(parsed.events[0].kind).toBe('handler_call');
      expect(parsed.events[1].kind).toBe('handler_return');
    });

    it('should maintain field order stability', () => {
      const emitter1 = createTraceEmitter({ correlationId: 'test-1' });
      const emitter2 = createTraceEmitter({ correlationId: 'test-2' });
      
      const event1 = emitter1.emitHandlerCall('test', { a: 1 });
      const event2 = emitter2.emitHandlerCall('test', { a: 1 });
      
      // Field keys should be in same order
      expect(Object.keys(event1)).toEqual(Object.keys(event2));
    });

    it('should preserve all required fields across serialization', () => {
      const requiredFields = ['time', 'kind', 'correlationId', 'handler', 'inputs', 'outputs', 'events'];
      
      const emitter = createTraceEmitter();
      const event = emitter.emitHandlerCall('test', {});
      const serialized = JSON.stringify(event);
      const deserialized = JSON.parse(serialized);
      
      for (const field of requiredFields) {
        expect(deserialized).toHaveProperty(field);
      }
    });

    it('should have stable REDACTED_FIELDS list', () => {
      // Ensure core redacted fields are present
      expect(ALWAYS_REDACTED_FIELDS).toContain('password');
      expect(ALWAYS_REDACTED_FIELDS).toContain('token');
      expect(ALWAYS_REDACTED_FIELDS).toContain('accessToken');
      expect(ALWAYS_REDACTED_FIELDS).toContain('apiKey');
      expect(ALWAYS_REDACTED_FIELDS).toContain('secret');
      
      expect(PII_FIELDS).toContain('email');
      expect(PII_FIELDS).toContain('ssn');
      expect(PII_FIELDS).toContain('phone');
      expect(PII_FIELDS).toContain('creditCard');
    });

    it('should have all login event kinds', () => {
      const requiredLoginKinds = [
        'rate_limit_checked',
        'audit_written',
        'session_created',
        'user_updated',
        'error_returned',
      ];
      
      for (const kind of requiredLoginKinds) {
        expect(ALL_EVENT_KINDS).toContain(kind);
      }
    });
  });
});
