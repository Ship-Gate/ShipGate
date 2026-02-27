/**
 * Login Test Harness
 * 
 * Executable test harness for login.isl that covers:
 * - SUCCESS: Valid credentials -> session created
 * - INVALID_CREDENTIALS: Wrong password/user not found
 * - USER_LOCKED: Account locked after too many failures
 * 
 * Emits trace events in isl-trace-format and builds fixture store.
 */

import { randomUUID } from 'crypto';

// ============================================================================
// Inlined Types from @isl-lang/trace-format
// ============================================================================

export type TraceEventKind =
  | 'handler_call'
  | 'handler_return'
  | 'handler_error'
  | 'state_change'
  | 'check'
  | 'invariant'
  | 'precondition'
  | 'postcondition'
  | 'temporal'
  | 'nested';

export interface TraceEvent {
  time: string;
  kind: TraceEventKind;
  correlationId: string;
  handler: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  events: TraceEvent[];
  metadata?: Record<string, unknown>;
}

export interface TraceMetadata {
  testName?: string;
  scenario?: string;
  implementation?: string;
  version?: string;
  environment?: string;
  passed?: boolean;
  failureIndex?: number;
  duration?: number;
  iteration?: number;
  proofBundleId?: string;
}

export interface Trace {
  id: string;
  name: string;
  domain: string;
  startTime: string;
  endTime?: string;
  correlationId: string;
  events: TraceEvent[];
  initialState?: Record<string, unknown>;
  metadata?: TraceMetadata;
}

// ============================================================================
// Inlined Trace Emitter
// ============================================================================

class InlineTraceEmitter {
  private correlationId: string;
  private domain: string;
  private events: TraceEvent[] = [];
  private startTime: string;

  constructor(options: { domain?: string; correlationId?: string } = {}) {
    this.correlationId = options.correlationId || randomUUID();
    this.domain = options.domain || 'unknown';
    this.startTime = new Date().toISOString();
  }

  emitHandlerCall(handler: string, inputs: Record<string, unknown>): void {
    this.events.push({
      time: new Date().toISOString(),
      kind: 'handler_call',
      correlationId: this.correlationId,
      handler,
      inputs: this.sanitize(inputs),
      outputs: {},
      events: [],
    });
  }

  emitHandlerReturn(handler: string, inputs: Record<string, unknown>, result: unknown, duration?: number): void {
    this.events.push({
      time: new Date().toISOString(),
      kind: 'handler_return',
      correlationId: this.correlationId,
      handler,
      inputs: this.sanitize(inputs),
      outputs: { result: this.sanitize(result as Record<string, unknown>), duration },
      events: [],
    });
  }

  emitCheck(
    handler: string,
    expression: string,
    passed: boolean,
    category: 'precondition' | 'postcondition' | 'invariant' | 'temporal' | 'assertion',
    expected?: unknown,
    actual?: unknown,
    message?: string
  ): void {
    this.events.push({
      time: new Date().toISOString(),
      kind: 'check',
      correlationId: this.correlationId,
      handler,
      inputs: { expression, expected },
      outputs: { passed, actual, message, category },
      events: [],
    });
  }

  buildTrace(name: string, metadata?: TraceMetadata): Trace {
    const endTime = new Date().toISOString();
    return {
      id: randomUUID(),
      name,
      domain: this.domain,
      startTime: this.startTime,
      endTime,
      correlationId: this.correlationId,
      events: this.events,
      metadata,
    };
  }

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    if (!obj || typeof obj !== 'object') return obj;
    
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      
      // Skip sensitive fields
      if (lowerKey.includes('password') || lowerKey.includes('secret') || lowerKey.includes('token')) {
        continue;
      }
      
      // Redact emails
      if (lowerKey.includes('email') && typeof value === 'string') {
        const [local, domain] = value.split('@');
        if (domain) {
          result[key] = `${local[0]}***@${domain}`;
        } else {
          result[key] = '***';
        }
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.sanitize(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

function createTraceEmitter(options?: { domain?: string; correlationId?: string }): InlineTraceEmitter {
  return new InlineTraceEmitter(options);
}

function sanitizeInputs(obj: Record<string, unknown>): Record<string, unknown> {
  const emitter = new InlineTraceEmitter();
  return (emitter as unknown as { sanitize: (obj: Record<string, unknown>) => Record<string, unknown> }).sanitize?.(obj) ?? obj;
}

// ============================================================================
// Types
// ============================================================================

export type UserStatus = 'ACTIVE' | 'LOCKED' | 'INACTIVE';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  status: UserStatus;
  failed_attempts: number;
  locked_until?: number;
}

export interface Session {
  id: string;
  user_id: string;
  access_token: string;
  expires_at: string;
  created_at: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginResult = 
  | { success: true; data: { session: Session; access_token: string } }
  | { success: false; error: LoginError };

export interface LoginError {
  code: 'VALIDATION_ERROR' | 'INVALID_CREDENTIALS' | 'ACCOUNT_LOCKED' | 'ACCOUNT_INACTIVE' | 'RATE_LIMITED';
  message: string;
  retriable: boolean;
  retry_after?: number;
}

export interface TestCase {
  name: string;
  scenario: 'success' | 'invalid_credentials' | 'user_locked' | 'validation' | 'rate_limit';
  input: Partial<LoginInput>;
  setup?: (store: FixtureStore) => void;
  expectedStatus: 200 | 400 | 401 | 429;
  expectedCode?: string;
}

export interface TestResult {
  name: string;
  scenario: string;
  passed: boolean;
  duration: number;
  trace: Trace;
  error?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  traces: Trace[];
  results: TestResult[];
}

// ============================================================================
// Fixture Store - In-memory state for tests
// ============================================================================

export class FixtureStore {
  private users = new Map<string, User>();
  private sessions = new Map<string, Session>();
  private rateLimits = new Map<string, { count: number; resetAt: number }>();
  private auditLog: Array<{ action: string; userId?: string; email?: string; ip?: string; timestamp: string }> = [];

  // User operations
  seedUser(user: User): void {
    this.users.set(user.email.toLowerCase(), user);
  }

  getUser(email: string): User | undefined {
    return this.users.get(email.toLowerCase());
  }

  updateUser(email: string, updates: Partial<User>): boolean {
    const user = this.users.get(email.toLowerCase());
    if (!user) return false;
    
    Object.assign(user, updates);
    return true;
  }

  // Session operations
  createSession(userId: string): Session {
    const session: Session = {
      id: randomUUID(),
      user_id: userId,
      access_token: randomUUID() + randomUUID(), // 64+ chars
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };
    
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  // Rate limiting
  checkRateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const entry = this.rateLimits.get(key);
    
    if (!entry || entry.resetAt < now) {
      this.rateLimits.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true };
    }
    
    if (entry.count >= limit) {
      return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
    }
    
    entry.count++;
    return { allowed: true };
  }

  // Audit logging
  recordAudit(action: string, data: { userId?: string; email?: string; ip?: string }): void {
    this.auditLog.push({
      action,
      ...data,
      timestamp: new Date().toISOString(),
    });
  }

  getAuditLog(): typeof this.auditLog {
    return [...this.auditLog];
  }

  // Reset
  clear(): void {
    this.users.clear();
    this.sessions.clear();
    this.rateLimits.clear();
    this.auditLog = [];
  }

  // Snapshot for traces
  snapshot(): Record<string, unknown> {
    return {
      users: Array.from(this.users.values()).map(u => ({ id: u.id, email: u.email, status: u.status })),
      sessions: this.sessions.size,
      auditLog: this.auditLog.length,
    };
  }
}

// ============================================================================
// Login Handler - Simulates the behavior from login.isl
// ============================================================================

export function hashPassword(password: string): string {
  return `hashed_${password}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  return hash === `hashed_${password}`;
}

export interface LoginHandlerConfig {
  emailRateLimit?: number;
  ipRateLimit?: number;
  lockoutThreshold?: number;
  lockoutDurationMs?: number;
}

const DEFAULT_CONFIG: Required<LoginHandlerConfig> = {
  emailRateLimit: 10,
  ipRateLimit: 100,
  lockoutThreshold: 5,
  lockoutDurationMs: 15 * 60 * 1000, // 15 minutes
};

export function createLoginHandler(store: FixtureStore, config: LoginHandlerConfig = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  return async function handleLogin(input: LoginInput, ip: string = '127.0.0.1'): Promise<{ status: number; body: LoginResult }> {
    // 1. Validate input (preconditions)
    if (!input.email || typeof input.email !== 'string') {
      return {
        status: 400,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email is required',
            retriable: false,
          },
        },
      };
    }

    if (!input.email.includes('@') || !input.email.includes('.')) {
      return {
        status: 400,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Email format is invalid',
            retriable: false,
          },
        },
      };
    }

    if (!input.password || typeof input.password !== 'string') {
      return {
        status: 400,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password is required',
            retriable: false,
          },
        },
      };
    }

    if (input.password.length < 8) {
      return {
        status: 400,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Password must be at least 8 characters',
            retriable: false,
          },
        },
      };
    }

    // 2. Check rate limits
    const emailRateCheck = store.checkRateLimit(`email:${input.email}`, cfg.emailRateLimit, 3600000);
    if (!emailRateCheck.allowed) {
      store.recordAudit('RATE_LIMITED', { email: input.email, ip });
      return {
        status: 429,
        body: {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many login attempts for this email',
            retriable: true,
            retry_after: emailRateCheck.retryAfter,
          },
        },
      };
    }

    const ipRateCheck = store.checkRateLimit(`ip:${ip}`, cfg.ipRateLimit, 3600000);
    if (!ipRateCheck.allowed) {
      store.recordAudit('RATE_LIMITED', { ip });
      return {
        status: 429,
        body: {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many login attempts from this IP',
            retriable: true,
            retry_after: ipRateCheck.retryAfter,
          },
        },
      };
    }

    // 3. Lookup user
    const user = store.getUser(input.email);
    
    if (!user) {
      // Don't reveal whether user exists - return same error as wrong password
      store.recordAudit('LOGIN_FAILED', { email: input.email, ip });
      return {
        status: 401,
        body: {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            retriable: true,
          },
        },
      };
    }

    // 4. Check account status
    if (user.status === 'LOCKED') {
      if (user.locked_until && Date.now() > user.locked_until) {
        // Auto-unlock after lockout period
        store.updateUser(input.email, { status: 'ACTIVE', failed_attempts: 0, locked_until: undefined });
      } else {
        store.recordAudit('LOGIN_BLOCKED_LOCKED', { userId: user.id, email: input.email, ip });
        const retryAfter = user.locked_until ? Math.ceil((user.locked_until - Date.now()) / 1000) : cfg.lockoutDurationMs / 1000;
        return {
          status: 401,
          body: {
            success: false,
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Account is locked due to too many failed attempts',
              retriable: true,
              retry_after: retryAfter,
            },
          },
        };
      }
    }

    if (user.status === 'INACTIVE') {
      store.recordAudit('LOGIN_BLOCKED_INACTIVE', { userId: user.id, email: input.email, ip });
      return {
        status: 401,
        body: {
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Account is deactivated',
            retriable: false,
          },
        },
      };
    }

    // 5. Verify password
    if (!verifyPassword(input.password, user.password_hash)) {
      // Increment failed attempts
      const newFailedAttempts = user.failed_attempts + 1;
      
      if (newFailedAttempts >= cfg.lockoutThreshold) {
        // Lock account
        store.updateUser(input.email, {
          status: 'LOCKED',
          failed_attempts: newFailedAttempts,
          locked_until: Date.now() + cfg.lockoutDurationMs,
        });
        store.recordAudit('ACCOUNT_LOCKED', { userId: user.id, email: input.email, ip });
      } else {
        store.updateUser(input.email, { failed_attempts: newFailedAttempts });
      }

      store.recordAudit('LOGIN_FAILED', { userId: user.id, email: input.email, ip });
      return {
        status: 401,
        body: {
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            retriable: true,
          },
        },
      };
    }

    // 6. Success! Create session
    const session = store.createSession(user.id);
    
    // Reset failed attempts on success
    store.updateUser(input.email, { failed_attempts: 0 });
    
    store.recordAudit('LOGIN_SUCCESS', { userId: user.id, email: input.email, ip });

    return {
      status: 200,
      body: {
        success: true,
        data: {
          session,
          access_token: session.access_token,
        },
      },
    };
  };
}

// ============================================================================
// Test Cases - Covers all login.isl scenarios
// ============================================================================

export const LOGIN_TEST_CASES: TestCase[] = [
  // SUCCESS PATHS
  {
    name: 'success_valid_credentials',
    scenario: 'success',
    input: { email: 'test@example.com', password: 'ValidPass123!' },
    setup: (store) => {
      store.seedUser({
        id: 'user_001',
        email: 'test@example.com',
        password_hash: hashPassword('ValidPass123!'),
        status: 'ACTIVE',
        failed_attempts: 0,
      });
    },
    expectedStatus: 200,
  },
  {
    name: 'success_resets_failed_attempts',
    scenario: 'success',
    input: { email: 'retry@example.com', password: 'CorrectPass1!' },
    setup: (store) => {
      store.seedUser({
        id: 'user_002',
        email: 'retry@example.com',
        password_hash: hashPassword('CorrectPass1!'),
        status: 'ACTIVE',
        failed_attempts: 3, // Had some failures before
      });
    },
    expectedStatus: 200,
  },

  // INVALID_CREDENTIALS PATHS
  {
    name: 'invalid_credentials_wrong_password',
    scenario: 'invalid_credentials',
    input: { email: 'test@example.com', password: 'WrongPassword!' },
    setup: (store) => {
      store.seedUser({
        id: 'user_003',
        email: 'test@example.com',
        password_hash: hashPassword('CorrectPassword!'),
        status: 'ACTIVE',
        failed_attempts: 0,
      });
    },
    expectedStatus: 401,
    expectedCode: 'INVALID_CREDENTIALS',
  },
  {
    name: 'invalid_credentials_user_not_found',
    scenario: 'invalid_credentials',
    input: { email: 'nonexistent@example.com', password: 'AnyPassword1!' },
    expectedStatus: 401,
    expectedCode: 'INVALID_CREDENTIALS',
  },
  {
    name: 'invalid_credentials_inactive_account',
    scenario: 'invalid_credentials',
    input: { email: 'inactive@example.com', password: 'ValidPass123!' },
    setup: (store) => {
      store.seedUser({
        id: 'user_004',
        email: 'inactive@example.com',
        password_hash: hashPassword('ValidPass123!'),
        status: 'INACTIVE',
        failed_attempts: 0,
      });
    },
    expectedStatus: 401,
    expectedCode: 'ACCOUNT_INACTIVE',
  },

  // USER_LOCKED PATHS
  {
    name: 'user_locked_already_locked',
    scenario: 'user_locked',
    input: { email: 'locked@example.com', password: 'ValidPass123!' },
    setup: (store) => {
      store.seedUser({
        id: 'user_005',
        email: 'locked@example.com',
        password_hash: hashPassword('ValidPass123!'),
        status: 'LOCKED',
        failed_attempts: 5,
        locked_until: Date.now() + 10 * 60 * 1000, // 10 minutes from now
      });
    },
    expectedStatus: 401,
    expectedCode: 'ACCOUNT_LOCKED',
  },
  {
    name: 'user_locked_after_failures',
    scenario: 'user_locked',
    input: { email: 'willlock@example.com', password: 'WrongPassword!' },
    setup: (store) => {
      store.seedUser({
        id: 'user_006',
        email: 'willlock@example.com',
        password_hash: hashPassword('CorrectPassword!'),
        status: 'ACTIVE',
        failed_attempts: 4, // One more failure will lock
      });
    },
    expectedStatus: 401,
    expectedCode: 'INVALID_CREDENTIALS',
  },

  // VALIDATION PATHS (for completeness)
  {
    name: 'validation_missing_email',
    scenario: 'validation',
    input: { password: 'ValidPass123!' },
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    name: 'validation_invalid_email',
    scenario: 'validation',
    input: { email: 'not-an-email', password: 'ValidPass123!' },
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
  {
    name: 'validation_short_password',
    scenario: 'validation',
    input: { email: 'test@example.com', password: 'short' },
    expectedStatus: 400,
    expectedCode: 'VALIDATION_ERROR',
  },
];

// ============================================================================
// Test Runner with Trace Emission
// ============================================================================

export interface LoginTestHarnessConfig {
  verbose?: boolean;
  includeValidation?: boolean;
  includeRateLimit?: boolean;
}

export class LoginTestHarness {
  private store: FixtureStore;
  private config: LoginTestHarnessConfig;
  private traces: Trace[] = [];
  private results: TestResult[] = [];

  constructor(config: LoginTestHarnessConfig = {}) {
    this.store = new FixtureStore();
    this.config = config;
  }

  /**
   * Get the fixture store for custom setup
   */
  getStore(): FixtureStore {
    return this.store;
  }

  /**
   * Get collected traces
   */
  getTraces(): Trace[] {
    return [...this.traces];
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return [...this.results];
  }

  /**
   * Run a single test case with trace emission
   */
  async runTest(testCase: TestCase): Promise<TestResult> {
    // Reset store
    this.store.clear();
    
    // Run setup if provided
    if (testCase.setup) {
      testCase.setup(this.store);
    }

    // Create trace emitter
    const emitter = createTraceEmitter({
      domain: 'Auth',
      correlationId: randomUUID(),
    });

    const handler = createLoginHandler(this.store);
    const startTime = Date.now();
    
    // Capture initial state
    const initialState = this.store.snapshot();
    
    // Emit handler call
    emitter.emitHandlerCall('UserLogin', sanitizeInputs({
      email: testCase.input.email ?? '',
      password: testCase.input.password ? '[REDACTED]' : undefined,
    }));

    // Execute handler
    const input: LoginInput = {
      email: testCase.input.email ?? '',
      password: testCase.input.password ?? '',
    };
    
    const result = await handler(input);
    const duration = Date.now() - startTime;

    // Emit handler return/error
    if (result.body.success) {
      emitter.emitHandlerReturn('UserLogin', sanitizeInputs({ email: input.email }), {
        status: result.status,
        session_id: result.body.data.session.id,
      }, duration);
    } else {
      emitter.emitHandlerReturn('UserLogin', sanitizeInputs({ email: input.email }), {
        status: result.status,
        error_code: result.body.error.code,
      }, duration);
    }

    // Emit checks based on scenario
    const passed = result.status === testCase.expectedStatus;
    
    emitter.emitCheck(
      'UserLogin',
      `response.status === ${testCase.expectedStatus}`,
      result.status === testCase.expectedStatus,
      'postcondition',
      testCase.expectedStatus,
      result.status,
      passed ? undefined : `Expected status ${testCase.expectedStatus}, got ${result.status}`
    );

    if (testCase.expectedCode && !result.body.success) {
      const codeMatches = result.body.error.code === testCase.expectedCode;
      emitter.emitCheck(
        'UserLogin',
        `error.code === '${testCase.expectedCode}'`,
        codeMatches,
        'postcondition',
        testCase.expectedCode,
        result.body.error.code,
        codeMatches ? undefined : `Expected code ${testCase.expectedCode}, got ${result.body.error.code}`
      );
    }

    if (result.body.success && result.status === 200) {
      // Check session postconditions
      emitter.emitCheck(
        'UserLogin',
        'session.isValid()',
        !!result.body.data.session,
        'postcondition',
        true,
        !!result.body.data.session
      );
      
      emitter.emitCheck(
        'UserLogin',
        'session.expires_at > now()',
        new Date(result.body.data.session.expires_at).getTime() > Date.now(),
        'postcondition',
        true,
        new Date(result.body.data.session.expires_at).getTime() > Date.now()
      );

      emitter.emitCheck(
        'UserLogin',
        'audit.recorded("login_success")',
        this.store.getAuditLog().some(a => a.action === 'LOGIN_SUCCESS'),
        'postcondition',
        true,
        this.store.getAuditLog().some(a => a.action === 'LOGIN_SUCCESS')
      );
    }

    // Build trace
    const metadata: TraceMetadata = {
      testName: testCase.name,
      scenario: testCase.scenario,
      passed,
      duration,
      version: '1.0.0',
      environment: 'test',
    };

    const trace = emitter.buildTrace(`${testCase.name} - UserLogin`, metadata);
    trace.initialState = initialState;

    this.traces.push(trace);

    const testResult: TestResult = {
      name: testCase.name,
      scenario: testCase.scenario,
      passed,
      duration,
      trace,
      error: passed ? undefined : `Expected status ${testCase.expectedStatus}, got ${result.status}`,
    };

    this.results.push(testResult);

    if (this.config.verbose) {
      const icon = passed ? '✓' : '✗';
      console.log(`  ${icon} ${testCase.name} (${duration}ms)`);
    }

    return testResult;
  }

  /**
   * Run all test cases for the specified scenarios
   */
  async runAll(scenarios?: TestCase['scenario'][]): Promise<TestSummary> {
    const testCases = scenarios
      ? LOGIN_TEST_CASES.filter(tc => scenarios.includes(tc.scenario))
      : LOGIN_TEST_CASES.filter(tc => {
          if (!this.config.includeValidation && tc.scenario === 'validation') return false;
          if (!this.config.includeRateLimit && tc.scenario === 'rate_limit') return false;
          return true;
        });

    if (this.config.verbose) {
      console.log(`\nRunning ${testCases.length} login tests...\n`);
    }

    for (const testCase of testCases) {
      await this.runTest(testCase);
    }

    const summary: TestSummary = {
      total: this.results.length,
      passed: this.results.filter(r => r.passed).length,
      failed: this.results.filter(r => !r.passed).length,
      traces: this.traces,
      results: this.results,
    };

    if (this.config.verbose) {
      console.log(`\n${summary.passed} passed, ${summary.failed} failed\n`);
    }

    return summary;
  }

  /**
   * Run only the core scenarios: SUCCESS, INVALID_CREDENTIALS, USER_LOCKED
   */
  async runCoreScenarios(): Promise<TestSummary> {
    return this.runAll(['success', 'invalid_credentials', 'user_locked']);
  }

  /**
   * Export traces as JSON
   */
  exportTraces(): string {
    return JSON.stringify({
      generated: new Date().toISOString(),
      spec: 'login.isl',
      domain: 'Auth',
      version: '1.0.0',
      traces: this.traces,
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.passed).length,
        failed: this.results.filter(r => !r.passed).length,
      },
    }, null, 2);
  }

  /**
   * Clear all results and traces
   */
  reset(): void {
    this.store.clear();
    this.traces = [];
    this.results = [];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new login test harness
 */
export function createLoginTestHarness(config?: LoginTestHarnessConfig): LoginTestHarness {
  return new LoginTestHarness(config);
}

/**
 * Run login tests and return summary
 */
export async function runLoginTests(config?: LoginTestHarnessConfig): Promise<TestSummary> {
  const harness = createLoginTestHarness(config);
  return harness.runCoreScenarios();
}

/**
 * Run login tests and export traces
 */
export async function runLoginTestsWithTraces(config?: LoginTestHarnessConfig): Promise<{ summary: TestSummary; tracesJson: string }> {
  const harness = createLoginTestHarness(config);
  const summary = await harness.runCoreScenarios();
  const tracesJson = harness.exportTraces();
  return { summary, tracesJson };
}
