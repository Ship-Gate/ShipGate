/**
 * Trace Format Fixtures
 * 
 * Sample trace events and traces for testing and documentation.
 * 
 * @module @isl-lang/trace-format/fixtures
 */

import type {
  TraceEvent,
  Trace,
  HandlerCallEvent,
  HandlerReturnEvent,
  CheckEvent,
  RateLimitCheckedEvent,
  AuditWrittenEvent,
  SessionCreatedEvent,
  UserUpdatedEvent,
  ErrorReturnedEvent,
} from './types.js';

/**
 * Sample handler call event
 */
export const sampleHandlerCallEvent: HandlerCallEvent = {
  time: '2026-02-02T10:00:00.000Z',
  kind: 'handler_call',
  correlationId: 'corr-123',
  handler: 'createUser',
  inputs: {
    name: 'John Doe',
    email: '[REDACTED]',
    role: 'user',
  },
  outputs: {},
  events: [],
};

/**
 * Sample handler return event
 */
export const sampleHandlerReturnEvent: HandlerReturnEvent = {
  time: '2026-02-02T10:00:01.000Z',
  kind: 'handler_return',
  correlationId: 'corr-123',
  handler: 'createUser',
  inputs: {
    name: 'John Doe',
    email: '[REDACTED]',
    role: 'user',
  },
  outputs: {
    result: {
      id: 'user-456',
      name: 'John Doe',
      email: '[REDACTED]',
      createdAt: '2026-02-02T10:00:01.000Z',
    },
    duration: 1000,
  },
  events: [],
};

/**
 * Sample check event (precondition)
 */
export const samplePreconditionCheck: CheckEvent = {
  time: '2026-02-02T10:00:00.500Z',
  kind: 'check',
  correlationId: 'corr-123',
  handler: 'createUser',
  inputs: {
    expression: 'email is valid',
    expected: true,
  },
  outputs: {
    passed: true,
    actual: true,
    category: 'precondition',
  },
  events: [],
};

/**
 * Sample check event (postcondition)
 */
export const samplePostconditionCheck: CheckEvent = {
  time: '2026-02-02T10:00:01.000Z',
  kind: 'check',
  correlationId: 'corr-123',
  handler: 'createUser',
  inputs: {
    expression: 'user.id is not null',
    expected: true,
  },
  outputs: {
    passed: true,
    actual: true,
    category: 'postcondition',
  },
  events: [],
};

/**
 * Sample complete trace
 */
export const sampleTrace: Trace = {
  id: 'trace-789',
  name: 'User Creation Test',
  domain: 'auth',
  startTime: '2026-02-02T10:00:00.000Z',
  endTime: '2026-02-02T10:00:01.000Z',
  correlationId: 'corr-123',
  events: [
    sampleHandlerCallEvent,
    samplePreconditionCheck,
    sampleHandlerReturnEvent,
    samplePostconditionCheck,
  ],
  initialState: {
    userCount: 0,
  },
  metadata: {
    testName: 'test_create_user',
    scenario: 'Create a new user with valid email',
    implementation: 'auth-service',
    version: '1.0.0',
    environment: 'test',
    passed: true,
    duration: 1000,
  },
};

/**
 * Sample trace with nested events
 */
export const sampleNestedTrace: Trace = {
  id: 'trace-nested-001',
  name: 'Nested Handler Trace',
  domain: 'payments',
  startTime: '2026-02-02T10:00:00.000Z',
  endTime: '2026-02-02T10:00:02.000Z',
  correlationId: 'corr-nested-001',
  events: [
    {
      time: '2026-02-02T10:00:00.000Z',
      kind: 'handler_call',
      correlationId: 'corr-nested-001',
      handler: 'processPayment',
      inputs: {
        amount: 1000,
        currency: 'USD',
        paymentMethod: '[REDACTED]',
      },
      outputs: {},
      events: [
        {
          time: '2026-02-02T10:00:00.500Z',
          kind: 'check',
          correlationId: 'corr-nested-001',
          handler: 'validatePayment',
          inputs: {
            expression: 'amount > 0',
          },
          outputs: {
            passed: true,
            category: 'precondition',
          },
          events: [],
        },
        {
          time: '2026-02-02T10:00:01.000Z',
          kind: 'state_change',
          correlationId: 'corr-nested-001',
          handler: 'updateBalance',
          inputs: {
            path: ['account', 'balance'],
            oldValue: 5000,
          },
          outputs: {
            newValue: 4000,
            source: 'processPayment',
          },
          events: [],
        },
      ],
    },
    {
      time: '2026-02-02T10:00:02.000Z',
      kind: 'handler_return',
      correlationId: 'corr-nested-001',
      handler: 'processPayment',
      inputs: {
        amount: 1000,
        currency: 'USD',
      },
      outputs: {
        result: {
          transactionId: 'txn-123',
          status: 'completed',
        },
        duration: 2000,
      },
      events: [],
    },
  ],
  metadata: {
    testName: 'test_process_payment',
    passed: true,
    duration: 2000,
  },
};

/**
 * Sample failing trace
 */
export const sampleFailingTrace: Trace = {
  id: 'trace-fail-001',
  name: 'Failed User Creation',
  domain: 'auth',
  startTime: '2026-02-02T10:00:00.000Z',
  endTime: '2026-02-02T10:00:00.500Z',
  correlationId: 'corr-fail-001',
  events: [
    {
      time: '2026-02-02T10:00:00.000Z',
      kind: 'handler_call',
      correlationId: 'corr-fail-001',
      handler: 'createUser',
      inputs: {
        name: 'John Doe',
        email: '[REDACTED]',
      },
      outputs: {},
      events: [],
    },
    {
      time: '2026-02-02T10:00:00.500Z',
      kind: 'check',
      correlationId: 'corr-fail-001',
      handler: 'createUser',
      inputs: {
        expression: 'email is valid',
        expected: true,
      },
      outputs: {
        passed: false,
        actual: false,
        message: 'Invalid email format',
        category: 'precondition',
      },
      events: [],
    },
  ],
  metadata: {
    testName: 'test_create_user_invalid_email',
    passed: false,
    failureIndex: 1,
    duration: 500,
  },
};

/**
 * Sample healer iteration trace
 */
export const sampleHealerIterationTrace: Trace = {
  id: 'trace-healer-001',
  name: 'Healer Iteration 3',
  domain: 'auth',
  startTime: '2026-02-02T10:00:00.000Z',
  endTime: '2026-02-02T10:00:05.000Z',
  correlationId: 'healer-iter-3',
  events: [
    {
      time: '2026-02-02T10:00:00.000Z',
      kind: 'handler_call',
      correlationId: 'healer-iter-3',
      handler: 'gateCheck',
      inputs: {
        iteration: 3,
        fingerprint: 'fp-abc123',
      },
      outputs: {},
      events: [],
    },
    {
      time: '2026-02-02T10:00:01.000Z',
      kind: 'check',
      correlationId: 'healer-iter-3',
      handler: 'gateCheck',
      inputs: {
        expression: 'intent/rate-limit-required',
      },
      outputs: {
        passed: false,
        category: 'precondition',
      },
      events: [],
    },
    {
      time: '2026-02-02T10:00:02.000Z',
      kind: 'state_change',
      correlationId: 'healer-iter-3',
      handler: 'applyPatch',
      inputs: {
        path: ['route.ts'],
        oldValue: 'export async function POST() {}',
      },
      outputs: {
        newValue: 'export async function POST() {\n  // @intent rate-limit-required\n  ...\n}',
        source: 'healer',
      },
      events: [],
    },
    {
      time: '2026-02-02T10:00:05.000Z',
      kind: 'handler_return',
      correlationId: 'healer-iter-3',
      handler: 'gateCheck',
      inputs: {},
      outputs: {
        result: {
          verdict: 'NO_SHIP',
          score: 75,
          violations: 1,
        },
        duration: 5000,
      },
      events: [],
    },
  ],
  metadata: {
    iteration: 3,
    proofBundleId: 'proof-xyz789',
    passed: false,
    duration: 5000,
  },
};

// ============================================================================
// Login-Specific Event Fixtures
// These demonstrate the Login clause verification events
// ============================================================================

/**
 * Sample rate limit checked event (allowed)
 */
export const sampleRateLimitCheckedEvent: RateLimitCheckedEvent = {
  time: '2026-02-02T10:00:00.000Z',
  kind: 'rate_limit_checked',
  correlationId: 'login-success-001',
  handler: 'Login',
  inputs: {
    identifier: '[IDENTIFIER_HASH]',
    identifierType: 'ip',
    limit: 5,
    windowSeconds: 300,
  },
  outputs: {
    allowed: true,
    currentCount: 1,
    remaining: 4,
    resetInSeconds: 300,
    exceeded: false,
  },
  events: [],
  timing: {
    startMs: 1738490400000,
    endMs: 1738490400005,
    durationMs: 5,
    sequence: 1,
  },
};

/**
 * Sample rate limit exceeded event
 */
export const sampleRateLimitExceededEvent: RateLimitCheckedEvent = {
  time: '2026-02-02T10:00:00.000Z',
  kind: 'rate_limit_checked',
  correlationId: 'login-rate-limited-001',
  handler: 'Login',
  inputs: {
    identifier: '[IDENTIFIER_HASH]',
    identifierType: 'ip',
    limit: 5,
    windowSeconds: 300,
  },
  outputs: {
    allowed: false,
    currentCount: 6,
    remaining: 0,
    resetInSeconds: 180,
    exceeded: true,
  },
  events: [],
  timing: {
    startMs: 1738490400000,
    endMs: 1738490400003,
    durationMs: 3,
    sequence: 1,
  },
};

/**
 * Sample audit written event (login success)
 */
export const sampleAuditWrittenEvent: AuditWrittenEvent = {
  time: '2026-02-02T10:00:00.500Z',
  kind: 'audit_written',
  correlationId: 'login-success-001',
  handler: 'Login',
  inputs: {
    action: 'login_success',
    actorId: 'user_[REDACTED]',
    targetId: 'session_[REDACTED]',
  },
  outputs: {
    success: true,
    auditId: 'audit_a1b2c3d4',
    timestamp: '2026-02-02T10:00:00.500Z',
    destination: 'database',
  },
  events: [],
  timing: {
    startMs: 1738490400500,
    endMs: 1738490400510,
    durationMs: 10,
    sequence: 4,
  },
};

/**
 * Sample audit written event (login failure)
 */
export const sampleAuditWrittenFailureEvent: AuditWrittenEvent = {
  time: '2026-02-02T10:00:00.300Z',
  kind: 'audit_written',
  correlationId: 'login-failure-001',
  handler: 'Login',
  inputs: {
    action: 'login_failure',
    actorId: 'unknown',
    targetId: undefined,
  },
  outputs: {
    success: true,
    auditId: 'audit_f1a2i3l4',
    timestamp: '2026-02-02T10:00:00.300Z',
    destination: 'database',
  },
  events: [],
  timing: {
    startMs: 1738490400300,
    endMs: 1738490400308,
    durationMs: 8,
    sequence: 3,
  },
};

/**
 * Sample session created event
 */
export const sampleSessionCreatedEvent: SessionCreatedEvent = {
  time: '2026-02-02T10:00:00.400Z',
  kind: 'session_created',
  correlationId: 'login-success-001',
  handler: 'Login',
  inputs: {
    userId: 'user_[REDACTED]',
    sessionType: 'access_token',
    scopes: ['read', 'write'],
  },
  outputs: {
    sessionId: 'sess****7890',
    tokenType: 'jwt',
    expiresAt: '2026-02-02T11:00:00.000Z',
    metadata: {
      userAgent: 'Mozilla/5.0',
      ipCountry: 'US',
      deviceType: 'desktop',
    },
  },
  events: [],
  timing: {
    startMs: 1738490400400,
    endMs: 1738490400420,
    durationMs: 20,
    sequence: 3,
  },
};

/**
 * Sample user updated event (last login)
 */
export const sampleUserUpdatedEvent: UserUpdatedEvent = {
  time: '2026-02-02T10:00:00.450Z',
  kind: 'user_updated',
  correlationId: 'login-success-001',
  handler: 'Login',
  inputs: {
    userId: 'user_[REDACTED]',
    fields: ['lastLoginAt', 'loginCount'],
    reason: 'login',
  },
  outputs: {
    success: true,
    updatedAt: '2026-02-02T10:00:00.450Z',
    changedFields: ['lastLoginAt', 'loginCount'],
  },
  events: [],
  timing: {
    startMs: 1738490400450,
    endMs: 1738490400455,
    durationMs: 5,
    sequence: 4,
  },
};

/**
 * Sample error returned event (invalid credentials)
 */
export const sampleErrorReturnedEvent: ErrorReturnedEvent = {
  time: '2026-02-02T10:00:00.350Z',
  kind: 'error_returned',
  correlationId: 'login-failure-001',
  handler: 'Login',
  inputs: {
    error: {
      name: 'AuthenticationError',
      code: 'INVALID_CREDENTIALS',
    },
    context: 'credential_verification',
  },
  outputs: {
    statusCode: 401,
    errorCode: 'INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    errorType: 'auth',
    retry: {
      allowed: true,
      afterSeconds: 0,
    },
  },
  events: [],
  timing: {
    startMs: 1738490400350,
    endMs: 1738490400352,
    durationMs: 2,
    sequence: 4,
  },
};

/**
 * Sample error returned event (rate limited)
 */
export const sampleRateLimitErrorEvent: ErrorReturnedEvent = {
  time: '2026-02-02T10:00:00.010Z',
  kind: 'error_returned',
  correlationId: 'login-rate-limited-001',
  handler: 'Login',
  inputs: {
    error: {
      name: 'RateLimitError',
      code: 'RATE_LIMIT_EXCEEDED',
    },
    context: 'rate_limit_check',
  },
  outputs: {
    statusCode: 429,
    errorCode: 'TOO_MANY_REQUESTS',
    message: 'Too many login attempts. Please try again later.',
    errorType: 'rate_limit',
    retry: {
      allowed: true,
      afterSeconds: 180,
    },
  },
  events: [],
  timing: {
    startMs: 1738490400010,
    endMs: 1738490400012,
    durationMs: 2,
    sequence: 2,
  },
};

// ============================================================================
// Login Success Trace (Complete Example)
// ============================================================================

/**
 * Complete Login Success Trace
 * 
 * This trace demonstrates a successful login flow with all required events:
 * 1. Handler call (Login attempt)
 * 2. Rate limit check (passed)
 * 3. Credential verification (passed)
 * 4. Session creation
 * 5. User record update (last_login)
 * 6. Audit log write
 * 7. Handler return (success)
 */
export const loginSuccessTrace: Trace = {
  id: 'trace-login-success-001',
  name: 'Login Success Flow',
  domain: 'auth',
  startTime: '2026-02-02T10:00:00.000Z',
  endTime: '2026-02-02T10:00:00.600Z',
  correlationId: 'login-success-001',
  events: [
    // 1. Handler call
    {
      time: '2026-02-02T10:00:00.000Z',
      kind: 'handler_call',
      correlationId: 'login-success-001',
      handler: 'Login',
      inputs: {
        email: '[EMAIL_REDACTED]',
        password: '[REDACTED]',
      },
      outputs: {},
      events: [],
      timing: {
        startMs: 1738490400000,
        sequence: 0,
      },
    },
    // 2. Rate limit check
    sampleRateLimitCheckedEvent,
    // 3. Credential verification (check event)
    {
      time: '2026-02-02T10:00:00.200Z',
      kind: 'check',
      correlationId: 'login-success-001',
      handler: 'Login',
      inputs: {
        expression: 'credentials.valid',
        expected: true,
      },
      outputs: {
        passed: true,
        actual: true,
        category: 'precondition',
      },
      events: [],
      timing: {
        startMs: 1738490400200,
        endMs: 1738490400250,
        durationMs: 50,
        sequence: 2,
      },
    },
    // 4. Session creation
    sampleSessionCreatedEvent,
    // 5. User update
    sampleUserUpdatedEvent,
    // 6. Audit write
    sampleAuditWrittenEvent,
    // 7. Handler return
    {
      time: '2026-02-02T10:00:00.600Z',
      kind: 'handler_return',
      correlationId: 'login-success-001',
      handler: 'Login',
      inputs: {
        email: '[EMAIL_REDACTED]',
      },
      outputs: {
        result: {
          success: true,
          session: {
            id: 'sess****7890',
            expiresAt: '2026-02-02T11:00:00.000Z',
          },
          accessToken: '[JWT_REDACTED]',
        },
        duration: 600,
      },
      events: [],
      timing: {
        startMs: 1738490400000,
        endMs: 1738490400600,
        durationMs: 600,
        sequence: 6,
      },
    },
  ],
  metadata: {
    testName: 'test_login_success',
    scenario: 'Successful login with valid credentials',
    implementation: 'auth-service',
    version: '1.0.0',
    environment: 'test',
    passed: true,
    duration: 600,
    auth: {
      outcome: 'success',
      userIdHash: 'sha256_abc123...',
      mfaRequired: false,
      mfaCompleted: false,
      recentFailedAttempts: 0,
      accountLocked: false,
    },
  },
};

// ============================================================================
// Login INVALID_CREDENTIALS Trace (Complete Example)
// ============================================================================

/**
 * Complete Login Invalid Credentials Trace
 * 
 * This trace demonstrates a failed login due to invalid credentials:
 * 1. Handler call (Login attempt)
 * 2. Rate limit check (passed - not rate limited yet)
 * 3. Credential verification (failed)
 * 4. Audit log write (login_failure)
 * 5. Error returned (401)
 * 6. Handler error
 */
export const loginInvalidCredentialsTrace: Trace = {
  id: 'trace-login-invalid-creds-001',
  name: 'Login Invalid Credentials Flow',
  domain: 'auth',
  startTime: '2026-02-02T10:00:00.000Z',
  endTime: '2026-02-02T10:00:00.400Z',
  correlationId: 'login-failure-001',
  events: [
    // 1. Handler call
    {
      time: '2026-02-02T10:00:00.000Z',
      kind: 'handler_call',
      correlationId: 'login-failure-001',
      handler: 'Login',
      inputs: {
        email: '[EMAIL_REDACTED]',
        password: '[REDACTED]',
      },
      outputs: {},
      events: [],
      timing: {
        startMs: 1738490400000,
        sequence: 0,
      },
    },
    // 2. Rate limit check (passed)
    {
      time: '2026-02-02T10:00:00.010Z',
      kind: 'rate_limit_checked',
      correlationId: 'login-failure-001',
      handler: 'Login',
      inputs: {
        identifier: '[IDENTIFIER_HASH]',
        identifierType: 'ip',
        limit: 5,
        windowSeconds: 300,
      },
      outputs: {
        allowed: true,
        currentCount: 2,
        remaining: 3,
        resetInSeconds: 250,
        exceeded: false,
      },
      events: [],
      timing: {
        startMs: 1738490400010,
        endMs: 1738490400015,
        durationMs: 5,
        sequence: 1,
      },
    },
    // 3. Credential verification (failed)
    {
      time: '2026-02-02T10:00:00.200Z',
      kind: 'check',
      correlationId: 'login-failure-001',
      handler: 'Login',
      inputs: {
        expression: 'credentials.valid',
        expected: true,
      },
      outputs: {
        passed: false,
        actual: false,
        message: 'Password does not match',
        category: 'precondition',
      },
      events: [],
      timing: {
        startMs: 1738490400200,
        endMs: 1738490400280,
        durationMs: 80,
        sequence: 2,
      },
    },
    // 4. Audit write (failure)
    sampleAuditWrittenFailureEvent,
    // 5. Error returned
    sampleErrorReturnedEvent,
    // 6. Handler error
    {
      time: '2026-02-02T10:00:00.400Z',
      kind: 'handler_error',
      correlationId: 'login-failure-001',
      handler: 'Login',
      inputs: {
        email: '[EMAIL_REDACTED]',
      },
      outputs: {
        error: {
          name: 'AuthenticationError',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        },
      },
      events: [],
      timing: {
        startMs: 1738490400000,
        endMs: 1738490400400,
        durationMs: 400,
        sequence: 5,
      },
    },
  ],
  metadata: {
    testName: 'test_login_invalid_credentials',
    scenario: 'Failed login with incorrect password',
    implementation: 'auth-service',
    version: '1.0.0',
    environment: 'test',
    passed: false,
    failureIndex: 2,
    duration: 400,
    auth: {
      outcome: 'invalid_credentials',
      userIdHash: 'sha256_abc123...',
      mfaRequired: false,
      mfaCompleted: false,
      recentFailedAttempts: 2,
      accountLocked: false,
    },
  },
};

// ============================================================================
// Login Rate Limited Trace (Complete Example)
// ============================================================================

/**
 * Complete Login Rate Limited Trace
 * 
 * This trace demonstrates a login blocked by rate limiting:
 * 1. Handler call (Login attempt)
 * 2. Rate limit check (exceeded)
 * 3. Audit log write (rate_limited event)
 * 4. Error returned (429)
 * 5. Handler error
 */
export const loginRateLimitedTrace: Trace = {
  id: 'trace-login-rate-limited-001',
  name: 'Login Rate Limited Flow',
  domain: 'auth',
  startTime: '2026-02-02T10:00:00.000Z',
  endTime: '2026-02-02T10:00:00.050Z',
  correlationId: 'login-rate-limited-001',
  events: [
    // 1. Handler call
    {
      time: '2026-02-02T10:00:00.000Z',
      kind: 'handler_call',
      correlationId: 'login-rate-limited-001',
      handler: 'Login',
      inputs: {
        email: '[EMAIL_REDACTED]',
        password: '[REDACTED]',
      },
      outputs: {},
      events: [],
      timing: {
        startMs: 1738490400000,
        sequence: 0,
      },
    },
    // 2. Rate limit check (exceeded)
    sampleRateLimitExceededEvent,
    // 3. Audit write
    {
      time: '2026-02-02T10:00:00.008Z',
      kind: 'audit_written',
      correlationId: 'login-rate-limited-001',
      handler: 'Login',
      inputs: {
        action: 'login_attempt',
        actorId: 'unknown',
      },
      outputs: {
        success: true,
        auditId: 'audit_rate_limit_001',
        timestamp: '2026-02-02T10:00:00.008Z',
        destination: 'database',
      },
      events: [],
      timing: {
        startMs: 1738490400008,
        durationMs: 2,
        sequence: 2,
      },
    },
    // 4. Error returned
    sampleRateLimitErrorEvent,
    // 5. Handler error
    {
      time: '2026-02-02T10:00:00.050Z',
      kind: 'handler_error',
      correlationId: 'login-rate-limited-001',
      handler: 'Login',
      inputs: {
        email: '[EMAIL_REDACTED]',
      },
      outputs: {
        error: {
          name: 'RateLimitError',
          message: 'Too many login attempts. Please try again later.',
          code: 'TOO_MANY_REQUESTS',
        },
      },
      events: [],
      timing: {
        startMs: 1738490400000,
        endMs: 1738490400050,
        durationMs: 50,
        sequence: 4,
      },
    },
  ],
  metadata: {
    testName: 'test_login_rate_limited',
    scenario: 'Login blocked by rate limiting',
    implementation: 'auth-service',
    version: '1.0.0',
    environment: 'test',
    passed: false,
    failureIndex: 1,
    duration: 50,
    auth: {
      outcome: 'rate_limited',
      mfaRequired: false,
      mfaCompleted: false,
      recentFailedAttempts: 6,
      accountLocked: false,
    },
  },
};

/**
 * All sample fixtures
 */
export const fixtures = {
  // Core fixtures
  sampleHandlerCallEvent,
  sampleHandlerReturnEvent,
  samplePreconditionCheck,
  samplePostconditionCheck,
  sampleTrace,
  sampleNestedTrace,
  sampleFailingTrace,
  sampleHealerIterationTrace,
  
  // Login-specific event fixtures
  sampleRateLimitCheckedEvent,
  sampleRateLimitExceededEvent,
  sampleAuditWrittenEvent,
  sampleAuditWrittenFailureEvent,
  sampleSessionCreatedEvent,
  sampleUserUpdatedEvent,
  sampleErrorReturnedEvent,
  sampleRateLimitErrorEvent,
  
  // Complete Login flow traces
  loginSuccessTrace,
  loginInvalidCredentialsTrace,
  loginRateLimitedTrace,
} as const;
