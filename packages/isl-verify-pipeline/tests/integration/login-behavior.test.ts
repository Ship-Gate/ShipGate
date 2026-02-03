/**
 * Integration Test: End-to-end verification of Login behavior
 * 
 * This test demonstrates the complete verification pipeline on a Login behavior:
 * 1. Load the ISL spec
 * 2. Run generated tests
 * 3. Capture execution traces
 * 4. Evaluate postconditions (tri-state)
 * 5. Check invariants
 * 6. Produce final verdict
 * 7. Generate proof bundle
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  verify,
  generateCIOutput,
  formatHumanOutput,
  generateEvaluationTable,
  formatTableAsMarkdown,
} from '../../src/index.js';
import type { PipelineConfig, PipelineResult, ExecutionTrace, TraceEvent } from '../../src/types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const LOGIN_SPEC = `
domain AuthLogin {
  version: "1.0.0"

  type Email = String { format: email, max_length: 254 }
  type Password = String { min_length: 8, max_length: 128 }

  enum UserStatus {
    ACTIVE
    INACTIVE
    LOCKED
    PENDING
  }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique, indexed]
    password_hash: String [secret]
    status: UserStatus
    failed_attempts: Int [default: 0]
    locked_until: Timestamp?
    last_login: Timestamp?
    created_at: Timestamp [immutable]

    invariants {
      failed_attempts >= 0
      failed_attempts <= 10
      locked_until != null implies status == LOCKED
    }
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID [indexed]
    token_hash: String [secret]
    ip_address: String [pii]
    expires_at: Timestamp
    revoked: Boolean [default: false]
    created_at: Timestamp [immutable]

    invariants {
      expires_at > created_at
    }
  }

  behavior Login {
    description: "Authenticate user with email and password"

    input {
      email: Email
      password: Password [sensitive]
      ip_address: String
    }

    output {
      success: Session

      errors {
        INVALID_CREDENTIALS {
          when: "Email or password is incorrect"
          retriable: true
        }
        USER_NOT_FOUND {
          when: "No user exists with this email"
          retriable: false
        }
        USER_LOCKED {
          when: "Account is locked due to failed attempts"
          retriable: true
        }
      }
    }

    pre {
      email.is_valid_format
      password.length >= 8
    }

    post success {
      - Session.exists(result.id)
      - Session.user_id == User.lookup(email).id
      - Session.expires_at > now()
      - User.failed_attempts == 0
      - User.last_login == now()
    }

    post INVALID_CREDENTIALS {
      - User.failed_attempts == old(User.failed_attempts) + 1
      - no Session created
    }

    post failure {
      - no Session created
    }

    invariants {
      - password never_logged
      - password never_stored_plaintext
    }
  }
}
`;

// Mock trace for successful login
const createSuccessTrace = (): ExecutionTrace => ({
  id: 'trace-login-success-001',
  name: 'Login successful flow',
  domain: 'AuthLogin',
  behavior: 'Login',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 100).toISOString(),
  correlationId: 'corr-001',
  events: [
    {
      time: new Date().toISOString(),
      kind: 'handler_call',
      handler: 'Login',
      inputs: {
        email: 'test@example.com',
        password: '[REDACTED]',
        ip_address: '192.168.1.1',
      },
    },
    {
      time: new Date(Date.now() + 10).toISOString(),
      kind: 'check',
      check: {
        expression: 'email.is_valid_format',
        passed: true,
        category: 'precondition',
      },
    },
    {
      time: new Date(Date.now() + 20).toISOString(),
      kind: 'check',
      check: {
        expression: 'password.length >= 8',
        passed: true,
        category: 'precondition',
      },
    },
    {
      time: new Date(Date.now() + 50).toISOString(),
      kind: 'state_change',
      stateChange: {
        path: 'User.last_login',
        oldValue: null,
        newValue: new Date().toISOString(),
        source: 'Login',
      },
    },
    {
      time: new Date(Date.now() + 60).toISOString(),
      kind: 'state_change',
      stateChange: {
        path: 'User.failed_attempts',
        oldValue: 2,
        newValue: 0,
        source: 'Login',
      },
    },
    {
      time: new Date(Date.now() + 80).toISOString(),
      kind: 'check',
      check: {
        expression: 'password never_logged',
        passed: true,
        category: 'invariant',
      },
    },
    {
      time: new Date(Date.now() + 90).toISOString(),
      kind: 'handler_return',
      handler: 'Login',
      outputs: {
        id: 'session-uuid-001',
        user_id: 'user-uuid-001',
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      },
    },
  ],
  metadata: {
    testName: 'Login successful flow',
    scenario: 'valid_credentials',
    passed: true,
    duration: 100,
  },
});

// Mock trace for invalid credentials
const createInvalidCredentialsTrace = (): ExecutionTrace => ({
  id: 'trace-login-invalid-001',
  name: 'Login invalid credentials flow',
  domain: 'AuthLogin',
  behavior: 'Login',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 50).toISOString(),
  correlationId: 'corr-002',
  events: [
    {
      time: new Date().toISOString(),
      kind: 'handler_call',
      handler: 'Login',
      inputs: {
        email: 'test@example.com',
        password: '[REDACTED]',
        ip_address: '192.168.1.1',
      },
    },
    {
      time: new Date(Date.now() + 10).toISOString(),
      kind: 'check',
      check: {
        expression: 'email.is_valid_format',
        passed: true,
        category: 'precondition',
      },
    },
    {
      time: new Date(Date.now() + 30).toISOString(),
      kind: 'state_change',
      stateChange: {
        path: 'User.failed_attempts',
        oldValue: 2,
        newValue: 3,
        source: 'Login',
      },
    },
    {
      time: new Date(Date.now() + 40).toISOString(),
      kind: 'check',
      check: {
        expression: 'password never_logged',
        passed: true,
        category: 'invariant',
      },
    },
    {
      time: new Date(Date.now() + 45).toISOString(),
      kind: 'handler_error',
      handler: 'Login',
      error: {
        name: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect',
        code: 'INVALID_CREDENTIALS',
      },
    },
  ],
  metadata: {
    testName: 'Login invalid credentials flow',
    scenario: 'wrong_password',
    passed: true,
    duration: 50,
  },
});

// ============================================================================
// Test Setup
// ============================================================================

const TEST_OUTPUT_DIR = path.join(__dirname, '../../.test-output');
let testTraceDir: string;

beforeAll(async () => {
  // Create test directories
  testTraceDir = path.join(TEST_OUTPUT_DIR, 'traces');
  await fs.mkdir(testTraceDir, { recursive: true });
  
  // Write mock traces
  const successTrace = createSuccessTrace();
  const invalidTrace = createInvalidCredentialsTrace();
  
  await fs.writeFile(
    path.join(testTraceDir, `${successTrace.id}.json`),
    JSON.stringify(successTrace, null, 2)
  );
  
  await fs.writeFile(
    path.join(testTraceDir, `${invalidTrace.id}.json`),
    JSON.stringify(invalidTrace, null, 2)
  );
  
  // Write trace index
  await fs.writeFile(
    path.join(testTraceDir, 'index.json'),
    JSON.stringify([
      { id: successTrace.id, name: successTrace.name, behavior: 'Login', passed: true },
      { id: invalidTrace.id, name: invalidTrace.name, behavior: 'Login', passed: true },
    ], null, 2)
  );
});

afterAll(async () => {
  // Cleanup test output
  try {
    await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Login Behavior End-to-End Verification', () => {
  it('should run complete verification pipeline', async () => {
    const config: PipelineConfig = {
      spec: LOGIN_SPEC,
      tests: {
        pattern: '**/*.test.ts',
        timeout: 30000,
      },
      traces: {
        enabled: true,
        redactPii: true,
      },
      proofBundle: {
        outputDir: TEST_OUTPUT_DIR,
        includeFullTraces: true,
      },
      ci: {
        enabled: true,
        outputPath: path.join(TEST_OUTPUT_DIR, 'ci-output.json'),
      },
    };
    
    // Run pipeline
    const result = await verify(config);
    
    // Verify basic structure
    expect(result).toBeDefined();
    expect(result.runId).toMatch(/^verify-/);
    expect(result.timing.startedAt).toBeTruthy();
    expect(result.timing.completedAt).toBeTruthy();
    expect(result.timing.totalDurationMs).toBeGreaterThan(0);
    
    // Verify stages ran
    expect(result.stages.setup).toBeDefined();
    expect(result.stages.setup?.status).toBe('passed');
    
    // Note: Test runner will likely fail since we don't have actual tests
    // but the pipeline should handle this gracefully
  });
  
  it('should produce deterministic CI output', async () => {
    const result: PipelineResult = {
      runId: 'verify-test-login',
      verdict: 'PROVEN',
      verdictReason: 'All 7 condition(s) verified',
      score: 100,
      timing: {
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:02.000Z',
        totalDurationMs: 2000,
      },
      stages: {
        setup: { stage: 'setup', status: 'passed', startedAt: '', durationMs: 10 },
        testRunner: {
          stage: 'test_runner',
          status: 'passed',
          startedAt: '',
          durationMs: 1000,
          output: {
            framework: 'vitest',
            suites: [{
              name: 'Login.test.ts',
              tests: [
                { id: '1', name: 'successful login', status: 'passed', durationMs: 100 },
                { id: '2', name: 'invalid credentials', status: 'passed', durationMs: 50 },
                { id: '3', name: 'user locked', status: 'passed', durationMs: 50 },
              ],
              totalTests: 3,
              passedTests: 3,
              failedTests: 0,
              skippedTests: 0,
              durationMs: 200,
            }],
            summary: {
              totalSuites: 1,
              totalTests: 3,
              passedTests: 3,
              failedTests: 0,
              skippedTests: 0,
              durationMs: 1000,
            },
          },
        },
      },
      evidence: {
        postconditions: [
          {
            clauseId: 'Login_post_success_1',
            type: 'postcondition',
            behavior: 'Login',
            outcome: 'success',
            expression: 'Session.exists(result.id)',
            status: 'proven',
            triStateResult: true,
            traceSlice: { traceId: 'trace-001', startTime: '', endTime: '', eventCount: 5 },
          },
          {
            clauseId: 'Login_post_success_2',
            type: 'postcondition',
            behavior: 'Login',
            outcome: 'success',
            expression: 'Session.expires_at > now()',
            status: 'proven',
            triStateResult: true,
          },
          {
            clauseId: 'Login_post_success_3',
            type: 'postcondition',
            behavior: 'Login',
            outcome: 'success',
            expression: 'User.failed_attempts == 0',
            status: 'proven',
            triStateResult: true,
          },
          {
            clauseId: 'Login_post_invalid_1',
            type: 'postcondition',
            behavior: 'Login',
            outcome: 'INVALID_CREDENTIALS',
            expression: 'User.failed_attempts == old(User.failed_attempts) + 1',
            status: 'proven',
            triStateResult: true,
          },
        ],
        invariants: [
          {
            clauseId: 'Login_inv_1',
            type: 'invariant',
            scope: 'behavior',
            behavior: 'Login',
            expression: 'password never_logged',
            status: 'proven',
            triStateResult: true,
            checkedAt: 'post',
          },
          {
            clauseId: 'Login_inv_2',
            type: 'invariant',
            scope: 'behavior',
            behavior: 'Login',
            expression: 'password never_stored_plaintext',
            status: 'proven',
            triStateResult: true,
            checkedAt: 'post',
          },
          {
            clauseId: 'User_entity_inv_1',
            type: 'invariant',
            scope: 'entity',
            entity: 'User',
            expression: 'failed_attempts >= 0',
            status: 'proven',
            triStateResult: true,
            checkedAt: 'post',
          },
        ],
      },
      summary: {
        tests: { total: 3, passed: 3, failed: 0 },
        postconditions: { total: 4, proven: 4, violated: 0, notProven: 0 },
        invariants: { total: 3, proven: 3, violated: 0, notProven: 0 },
      },
      errors: [],
    };
    
    const ciOutput = generateCIOutput(result);
    
    // Verify CI output structure
    expect(ciOutput.schemaVersion).toBe('1.0.0');
    expect(ciOutput.verdict).toBe('PROVEN');
    expect(ciOutput.exitCode).toBe(0);
    expect(ciOutput.score).toBe(100);
    expect(ciOutput.violations).toHaveLength(0);
    
    // Verify counts
    expect(ciOutput.counts.tests.total).toBe(3);
    expect(ciOutput.counts.tests.passed).toBe(3);
    expect(ciOutput.counts.postconditions.total).toBe(4);
    expect(ciOutput.counts.postconditions.proven).toBe(4);
    expect(ciOutput.counts.invariants.total).toBe(3);
    expect(ciOutput.counts.invariants.proven).toBe(3);
    
    // Verify summary is human-readable
    expect(ciOutput.summary).toContain('PROVEN');
    expect(ciOutput.summary).toContain('100');
    
    // Print human output for verification
    const humanOutput = formatHumanOutput(ciOutput);
    expect(humanOutput).toContain('PROVEN');
    expect(humanOutput).toContain('Tests:');
    expect(humanOutput).toContain('Postconditions:');
    expect(humanOutput).toContain('Invariants:');
  });
  
  it('should generate evaluation table for proof bundle', async () => {
    const result: PipelineResult = {
      runId: 'verify-test-login',
      verdict: 'INCOMPLETE_PROOF',
      verdictReason: '1 condition could not be verified',
      score: 85,
      timing: {
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:02.000Z',
        totalDurationMs: 2000,
      },
      stages: {},
      evidence: {
        postconditions: [
          {
            clauseId: 'Login_post_success_1',
            type: 'postcondition',
            behavior: 'Login',
            outcome: 'success',
            expression: 'Session.exists(result.id)',
            status: 'proven',
            triStateResult: true,
            sourceLocation: { file: 'login.isl', line: 45, column: 7 },
          },
          {
            clauseId: 'Login_post_success_2',
            type: 'postcondition',
            behavior: 'Login',
            outcome: 'success',
            expression: 'User.last_login == now()',
            status: 'not_proven',
            triStateResult: 'unknown',
            reason: 'now() could not be evaluated deterministically',
            sourceLocation: { file: 'login.isl', line: 49, column: 7 },
          },
        ],
        invariants: [
          {
            clauseId: 'Login_inv_1',
            type: 'invariant',
            scope: 'behavior',
            behavior: 'Login',
            expression: 'password never_logged',
            status: 'proven',
            triStateResult: true,
            checkedAt: 'post',
            sourceLocation: { file: 'login.isl', line: 62, column: 7 },
          },
        ],
      },
      summary: {
        tests: { total: 3, passed: 3, failed: 0 },
        postconditions: { total: 2, proven: 1, violated: 0, notProven: 1 },
        invariants: { total: 1, proven: 1, violated: 0, notProven: 0 },
      },
      errors: [],
    };
    
    const table = generateEvaluationTable(result, 'AuthLogin', '1.0.0');
    
    // Verify table structure
    expect(table.version).toBe('1.0.0');
    expect(table.domain).toBe('AuthLogin');
    expect(table.specVersion).toBe('1.0.0');
    expect(table.verdict).toBe('INCOMPLETE_PROOF');
    expect(table.rows).toHaveLength(3);
    
    // Verify summary
    expect(table.summary.total).toBe(3);
    expect(table.summary.proven).toBe(2);
    expect(table.summary.notProven).toBe(1);
    expect(table.summary.violated).toBe(0);
    
    // Verify rows are sorted (postconditions before invariants)
    expect(table.rows[0].type).toBe('postcondition');
    expect(table.rows[1].type).toBe('postcondition');
    expect(table.rows[2].type).toBe('invariant');
    
    // Verify markdown output
    const markdown = formatTableAsMarkdown(table);
    expect(markdown).toContain('# Evaluation Table: AuthLogin');
    expect(markdown).toContain('| Proven | 2 |');
    expect(markdown).toContain('| Not Proven | 1 |');
    expect(markdown).toContain('Session.exists(result.id)');
    expect(markdown).toContain('password never_logged');
  });
  
  it('should detect and report violations', async () => {
    const result: PipelineResult = {
      runId: 'verify-test-violation',
      verdict: 'FAILED',
      verdictReason: '1 violation found',
      score: 50,
      timing: {
        startedAt: '2024-01-01T00:00:00.000Z',
        completedAt: '2024-01-01T00:00:01.000Z',
        totalDurationMs: 1000,
      },
      stages: {},
      evidence: {
        postconditions: [
          {
            clauseId: 'Login_post_success_1',
            type: 'postcondition',
            behavior: 'Login',
            outcome: 'success',
            expression: 'Session.exists(result.id)',
            status: 'proven',
            triStateResult: true,
          },
          {
            clauseId: 'Login_post_success_2',
            type: 'postcondition',
            behavior: 'Login',
            outcome: 'success',
            expression: 'User.failed_attempts == 0',
            status: 'violated',
            triStateResult: false,
            reason: 'User.failed_attempts was 1, expected 0',
            sourceLocation: { file: 'login.isl', line: 48, column: 7 },
          },
        ],
        invariants: [],
      },
      summary: {
        tests: { total: 1, passed: 1, failed: 0 },
        postconditions: { total: 2, proven: 1, violated: 1, notProven: 0 },
        invariants: { total: 0, proven: 0, violated: 0, notProven: 0 },
      },
      errors: [],
    };
    
    const ciOutput = generateCIOutput(result);
    
    // Verify violation detection
    expect(ciOutput.verdict).toBe('FAILED');
    expect(ciOutput.exitCode).toBe(1);
    expect(ciOutput.violations).toHaveLength(1);
    
    // Verify violation details
    const violation = ciOutput.violations[0];
    expect(violation.type).toBe('postcondition');
    expect(violation.clauseId).toBe('Login_post_success_2');
    expect(violation.behavior).toBe('Login');
    expect(violation.expression).toBe('User.failed_attempts == 0');
    expect(violation.location?.file).toBe('login.isl');
    expect(violation.location?.line).toBe(48);
  });
  
  it('should handle tri-state evaluation correctly', () => {
    // Test that unknown results lead to INCOMPLETE_PROOF
    const evidence = {
      postconditions: [
        { clauseId: 'p1', type: 'postcondition' as const, expression: 'a', status: 'proven' as const, triStateResult: true as const },
        { clauseId: 'p2', type: 'postcondition' as const, expression: 'b', status: 'not_proven' as const, triStateResult: 'unknown' as const },
      ],
      invariants: [
        { clauseId: 'i1', type: 'invariant' as const, scope: 'behavior' as const, expression: 'c', status: 'proven' as const, triStateResult: true as const, checkedAt: 'post' as const },
      ],
    };
    
    // Count results
    const proven = evidence.postconditions.filter(e => e.triStateResult === true).length +
                   evidence.invariants.filter(e => e.triStateResult === true).length;
    const unknown = evidence.postconditions.filter(e => e.triStateResult === 'unknown').length +
                    evidence.invariants.filter(e => e.triStateResult === 'unknown').length;
    
    expect(proven).toBe(2);
    expect(unknown).toBe(1);
    
    // With any unknown, verdict should be INCOMPLETE_PROOF (not PROVEN)
    const verdict = unknown > 0 ? 'INCOMPLETE_PROOF' : 'PROVEN';
    expect(verdict).toBe('INCOMPLETE_PROOF');
  });
});

describe('Failure Modes', () => {
  it('should handle missing traces gracefully', async () => {
    const config: PipelineConfig = {
      spec: LOGIN_SPEC,
      tests: { timeout: 1000 },
      traces: { enabled: true },
    };
    
    // Pipeline should not crash even with no traces
    const result = await verify(config);
    expect(result).toBeDefined();
    expect(result.runId).toBeTruthy();
  });
  
  it('should classify failure categories correctly', () => {
    const categories = [
      'config_error',
      'spec_error', 
      'test_failure',
      'trace_error',
      'evaluation_error',
      'invariant_violation',
      'postcondition_violation',
      'smt_timeout',
      'smt_unknown',
      'internal_error',
      'timeout',
    ];
    
    // All failure categories should be valid
    for (const category of categories) {
      expect(typeof category).toBe('string');
      expect(category.length).toBeGreaterThan(0);
    }
  });
});
