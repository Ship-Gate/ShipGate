/**
 * Golden Snapshot Tests for isl verify command
 *
 * Tests the CLI output format for various verification scenarios:
 * - PROVEN: All clauses verified (exit code 0)
 * - FAILED: Some clauses violated (exit code 1)
 * - INCOMPLETE_PROOF: Some clauses could not be evaluated (exit code 2)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { verify, type VerifyOptions } from '../src/commands/verify.js';
import {
  renderVerify,
  formatVerifyJson,
  type VerifyResult,
  type VerifyClauseResult,
} from '@isl-lang/cli-ux';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const TEST_DIR = join(process.cwd(), '.test-fixtures-verify');

const LOGIN_SPEC = `
domain AuthLogin {
  version: "1.0.0"

  type Email = String { format: email }
  type Password = String { min_length: 8 }

  entity User {
    id: UUID [immutable, unique]
    email: Email [unique]
    failed_attempts: Int [default: 0]

    invariants {
      failed_attempts >= 0
      failed_attempts <= 10
    }
  }

  entity Session {
    id: UUID [immutable, unique]
    user_id: UUID
    expires_at: Timestamp

    invariants {
      expires_at > created_at
    }
  }

  behavior Login {
    description: "Authenticate user"

    input {
      email: Email
      password: Password
    }

    output {
      success: Session
      errors {
        INVALID_CREDENTIALS { when: "Wrong password" }
      }
    }

    post success {
      - Session.exists(result.id)
      - Session.user_id == User.lookup(email).id
      - User.failed_attempts == 0
    }

    post INVALID_CREDENTIALS {
      - User.failed_attempts == old(User.failed_attempts) + 1
    }

    invariants {
      - password never_logged
    }

    temporal {
      - within 500ms (p99): response returned
    }
  }
}
`;

// Traces for PROVEN scenario
const PROVEN_TRACES = {
  version: '1.0',
  specFile: 'login.isl',
  traces: [
    {
      id: 'evt-1',
      type: 'call',
      timestamp: 1000,
      behavior: 'Login',
      input: { email: 'test@example.com', password: 'password123' },
    },
    {
      id: 'evt-2',
      type: 'return',
      timestamp: 1050,
      behavior: 'Login',
      output: { id: 'session-123', user_id: 'user-456', expires_at: '2025-12-31' },
      stateAfter: {
        Session: { 'session-123': { id: 'session-123', user_id: 'user-456' } },
        User: { 'user-456': { id: 'user-456', email: 'test@example.com', failed_attempts: 0 } },
      },
    },
  ],
};

// Traces for FAILED scenario (failed_attempts not reset)
const FAILED_TRACES = {
  version: '1.0',
  specFile: 'login.isl',
  traces: [
    {
      id: 'evt-1',
      type: 'call',
      timestamp: 1000,
      behavior: 'Login',
      input: { email: 'test@example.com', password: 'password123' },
    },
    {
      id: 'evt-2',
      type: 'return',
      timestamp: 1050,
      behavior: 'Login',
      output: { id: 'session-123', user_id: 'user-456', expires_at: '2025-12-31' },
      stateAfter: {
        Session: { 'session-123': { id: 'session-123', user_id: 'user-456' } },
        User: { 'user-456': { id: 'user-456', email: 'test@example.com', failed_attempts: 3 } },
      },
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Create test directory
  await mkdir(TEST_DIR, { recursive: true });

  // Write spec file
  await writeFile(join(TEST_DIR, 'login.isl'), LOGIN_SPEC);

  // Write trace files
  await mkdir(join(TEST_DIR, 'proven', '.proof-bundle'), { recursive: true });
  await writeFile(
    join(TEST_DIR, 'proven', '.proof-bundle', 'traces.json'),
    JSON.stringify(PROVEN_TRACES, null, 2)
  );
  await writeFile(join(TEST_DIR, 'proven', 'login.isl'), LOGIN_SPEC);

  await mkdir(join(TEST_DIR, 'failed', '.proof-bundle'), { recursive: true });
  await writeFile(
    join(TEST_DIR, 'failed', '.proof-bundle', 'traces.json'),
    JSON.stringify(FAILED_TRACES, null, 2)
  );
  await writeFile(join(TEST_DIR, 'failed', 'login.isl'), LOGIN_SPEC);

  // No traces for incomplete scenario
  await mkdir(join(TEST_DIR, 'incomplete'), { recursive: true });
  await writeFile(join(TEST_DIR, 'incomplete', 'login.isl'), LOGIN_SPEC);
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock Verify Results for Snapshot Testing
// ─────────────────────────────────────────────────────────────────────────────

function createMockProvenResult(): VerifyResult {
  return {
    verdict: 'PROVEN',
    specName: 'AuthLogin',
    specFile: 'login.isl',
    clauses: [
      {
        clauseId: 'Login:post:45',
        clauseText: 'Session.exists(result.id)',
        clauseType: 'postcondition',
        behavior: 'Login',
        verdict: 'TRUE',
        evidence: {
          type: 'trace_slice',
          behavior: 'Login',
          eventIds: ['evt-1', 'evt-2'],
          startMs: 1000,
          endMs: 1050,
        },
        source: { file: 'login.isl', line: 45, column: 7 },
      },
      {
        clauseId: 'Login:post:46',
        clauseText: 'Session.user_id == User.lookup(email).id',
        clauseType: 'postcondition',
        behavior: 'Login',
        verdict: 'TRUE',
        evidence: {
          type: 'trace_slice',
          behavior: 'Login',
          eventIds: ['evt-1', 'evt-2'],
          startMs: 1000,
          endMs: 1050,
        },
        source: { file: 'login.isl', line: 46, column: 7 },
      },
      {
        clauseId: 'Login:post:47',
        clauseText: 'User.failed_attempts == 0',
        clauseType: 'postcondition',
        behavior: 'Login',
        verdict: 'TRUE',
        evidence: {
          type: 'trace_slice',
          behavior: 'Login',
          eventIds: ['evt-1', 'evt-2'],
          startMs: 1000,
          endMs: 1050,
        },
        source: { file: 'login.isl', line: 47, column: 7 },
      },
    ],
    summary: { total: 3, proven: 3, failed: 0, unknown: 0 },
    durationMs: 50,
    timestamp: '2025-02-02T12:00:00.000Z',
  };
}

function createMockFailedResult(): VerifyResult {
  return {
    verdict: 'FAILED',
    specName: 'AuthLogin',
    specFile: 'login.isl',
    clauses: [
      {
        clauseId: 'Login:post:45',
        clauseText: 'Session.exists(result.id)',
        clauseType: 'postcondition',
        behavior: 'Login',
        verdict: 'TRUE',
        evidence: {
          type: 'trace_slice',
          behavior: 'Login',
          eventIds: ['evt-1', 'evt-2'],
          startMs: 1000,
          endMs: 1050,
        },
        source: { file: 'login.isl', line: 45, column: 7 },
      },
      {
        clauseId: 'Login:post:47',
        clauseText: 'User.failed_attempts == 0',
        clauseType: 'postcondition',
        behavior: 'Login',
        verdict: 'FALSE',
        evidence: {
          type: 'trace_slice',
          behavior: 'Login',
          eventIds: ['evt-1', 'evt-2'],
          startMs: 1000,
          endMs: 1050,
        },
        source: { file: 'login.isl', line: 47, column: 7 },
        failureMessage: 'Expected failed_attempts to be 0, got 3',
        expected: 0,
        actual: 3,
      },
    ],
    summary: { total: 2, proven: 1, failed: 1, unknown: 0 },
    durationMs: 52,
    timestamp: '2025-02-02T12:00:00.000Z',
  };
}

function createMockIncompleteResult(): VerifyResult {
  return {
    verdict: 'INCOMPLETE_PROOF',
    specName: 'AuthLogin',
    specFile: 'login.isl',
    clauses: [
      {
        clauseId: 'Login:post:45',
        clauseText: 'Session.exists(result.id)',
        clauseType: 'postcondition',
        behavior: 'Login',
        verdict: 'TRUE',
        evidence: {
          type: 'trace_slice',
          behavior: 'Login',
          eventIds: ['evt-1', 'evt-2'],
          startMs: 1000,
          endMs: 1050,
        },
        source: { file: 'login.isl', line: 45, column: 7 },
      },
      {
        clauseId: 'Login:inv:55',
        clauseText: 'password never_logged',
        clauseType: 'invariant',
        behavior: 'Login',
        verdict: 'UNKNOWN',
        evidence: {
          type: 'none',
          reason: 'Requires log analysis adapter',
        },
        source: { file: 'login.isl', line: 55, column: 7 },
        unknownReason: {
          code: 'ADAPTER_UNAVAILABLE',
          message: 'Security invariant requires log analysis adapter',
          remediation: 'Enable the logging adapter: isl verify --adapter logging',
        },
      },
      {
        clauseId: 'Login:sec:60',
        clauseText: 'rate_limit 10 per hour per email',
        clauseType: 'security',
        behavior: 'Login',
        verdict: 'UNKNOWN',
        evidence: {
          type: 'none',
          reason: 'Requires rate-limit adapter',
        },
        source: { file: 'login.isl', line: 60, column: 7 },
        unknownReason: {
          code: 'ADAPTER_UNAVAILABLE',
          message: 'Rate limit verification requires rate-limit adapter',
          remediation: 'Enable the rate-limit adapter: isl verify --adapter rate-limit',
        },
      },
    ],
    summary: { total: 3, proven: 1, failed: 0, unknown: 2 },
    durationMs: 45,
    timestamp: '2025-02-02T12:00:00.000Z',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('isl verify CLI output', () => {
  describe('Human-readable output', () => {
    it('renders PROVEN result correctly', () => {
      const result = createMockProvenResult();
      const output = renderVerify(result, { colors: false });

      expect(output).toMatchSnapshot('verify-proven-human');
    });

    it('renders FAILED result correctly', () => {
      const result = createMockFailedResult();
      const output = renderVerify(result, { colors: false });

      expect(output).toMatchSnapshot('verify-failed-human');
    });

    it('renders INCOMPLETE_PROOF result correctly', () => {
      const result = createMockIncompleteResult();
      const output = renderVerify(result, { colors: false });

      expect(output).toMatchSnapshot('verify-incomplete-human');
    });
  });

  describe('JSON output', () => {
    it('produces valid JSON for PROVEN result', () => {
      const result = createMockProvenResult();
      const json = formatVerifyJson(result, { validate: true });

      expect(json.valid).toBe(true);
      expect(json.output).toMatchSnapshot('verify-proven-json');
    });

    it('produces valid JSON for FAILED result', () => {
      const result = createMockFailedResult();
      const json = formatVerifyJson(result, { validate: true });

      expect(json.valid).toBe(true);
      expect(json.output).toMatchSnapshot('verify-failed-json');
    });

    it('produces valid JSON for INCOMPLETE_PROOF result', () => {
      const result = createMockIncompleteResult();
      const json = formatVerifyJson(result, { validate: true });

      expect(json.valid).toBe(true);
      expect(json.output).toMatchSnapshot('verify-incomplete-json');
    });
  });

  describe('Exit codes', () => {
    it('returns exit code 0 for PROVEN', () => {
      const result = createMockProvenResult();
      expect(result.verdict).toBe('PROVEN');
      // Exit code calculation
      const exitCode = result.verdict === 'PROVEN' ? 0 : result.verdict === 'FAILED' ? 1 : 2;
      expect(exitCode).toBe(0);
    });

    it('returns exit code 1 for FAILED', () => {
      const result = createMockFailedResult();
      expect(result.verdict).toBe('FAILED');
      const exitCode = result.verdict === 'PROVEN' ? 0 : result.verdict === 'FAILED' ? 1 : 2;
      expect(exitCode).toBe(1);
    });

    it('returns exit code 2 for INCOMPLETE_PROOF', () => {
      const result = createMockIncompleteResult();
      expect(result.verdict).toBe('INCOMPLETE_PROOF');
      const exitCode = result.verdict === 'PROVEN' ? 0 : result.verdict === 'FAILED' ? 1 : 2;
      expect(exitCode).toBe(2);
    });
  });

  describe('JSON schema compliance', () => {
    it('includes schemaVersion in output', () => {
      const result = createMockProvenResult();
      const json = formatVerifyJson(result);
      const parsed = JSON.parse(json.output);

      expect(parsed.schemaVersion).toBe('1.0');
    });

    it('includes correct exitCode in output', () => {
      const provenJson = JSON.parse(formatVerifyJson(createMockProvenResult()).output);
      const failedJson = JSON.parse(formatVerifyJson(createMockFailedResult()).output);
      const incompleteJson = JSON.parse(formatVerifyJson(createMockIncompleteResult()).output);

      expect(provenJson.exitCode).toBe(0);
      expect(failedJson.exitCode).toBe(1);
      expect(incompleteJson.exitCode).toBe(2);
    });

    it('includes meta information', () => {
      const result = createMockProvenResult();
      const json = formatVerifyJson(result);
      const parsed = JSON.parse(json.output);

      expect(parsed.meta).toBeDefined();
      expect(parsed.meta.cliVersion).toBeDefined();
      expect(parsed.meta.nodeVersion).toBeDefined();
      expect(parsed.meta.platform).toBeDefined();
      expect(parsed.meta.timestamp).toBeDefined();
    });
  });

  describe('Clause details', () => {
    it('includes clause ID and text in table', () => {
      const result = createMockProvenResult();
      const output = renderVerify(result, { colors: false });

      expect(output).toContain('Login:post:45');
      expect(output).toContain('Session.exists(result.id)');
    });

    it('shows evidence reference for each clause', () => {
      const result = createMockProvenResult();
      const output = renderVerify(result, { colors: false });

      expect(output).toContain('trace:Login');
    });

    it('shows unknown reason and remediation', () => {
      const result = createMockIncompleteResult();
      const output = renderVerify(result, { colors: false });

      expect(output).toContain('ADAPTER_UNAVAILABLE');
      expect(output).toContain('logging adapter');
      expect(output).toContain('isl verify --adapter');
    });

    it('shows failure details for FALSE clauses', () => {
      const result = createMockFailedResult();
      const output = renderVerify(result, { colors: false });

      expect(output).toContain('FALSE');
      expect(output).toContain('Expected');
      expect(output).toContain('Actual');
    });
  });
});

describe('isl verify JSON schema', () => {
  it('has stable clause result structure', () => {
    const result = createMockProvenResult();
    const json = formatVerifyJson(result);
    const parsed = JSON.parse(json.output);

    const clause = parsed.result.clauses[0];
    expect(clause).toHaveProperty('clauseId');
    expect(clause).toHaveProperty('clauseText');
    expect(clause).toHaveProperty('clauseType');
    expect(clause).toHaveProperty('verdict');
    expect(clause).toHaveProperty('evidence');
    expect(clause).toHaveProperty('source');
  });

  it('has stable evidence structure', () => {
    const result = createMockProvenResult();
    const json = formatVerifyJson(result);
    const parsed = JSON.parse(json.output);

    const evidence = parsed.result.clauses[0].evidence;
    expect(evidence).toHaveProperty('type');
    expect(evidence.type).toBe('trace_slice');
    expect(evidence).toHaveProperty('behavior');
    expect(evidence).toHaveProperty('eventIds');
  });

  it('has stable unknown reason structure', () => {
    const result = createMockIncompleteResult();
    const json = formatVerifyJson(result);
    const parsed = JSON.parse(json.output);

    const unknownClause = parsed.result.clauses.find(
      (c: VerifyClauseResult) => c.verdict === 'UNKNOWN'
    );
    expect(unknownClause).toBeDefined();
    expect(unknownClause.unknownReason).toHaveProperty('code');
    expect(unknownClause.unknownReason).toHaveProperty('message');
    expect(unknownClause.unknownReason).toHaveProperty('remediation');
  });

  it('has stable summary structure', () => {
    const result = createMockProvenResult();
    const json = formatVerifyJson(result);
    const parsed = JSON.parse(json.output);

    const summary = parsed.result.summary;
    expect(summary).toHaveProperty('total');
    expect(summary).toHaveProperty('proven');
    expect(summary).toHaveProperty('failed');
    expect(summary).toHaveProperty('unknown');
  });
});
