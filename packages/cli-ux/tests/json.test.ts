/**
 * JSON Output Tests
 *
 * Schema validation and JSON output tests.
 */

import { describe, it, expect } from 'vitest';
import {
  formatJson,
  parseJson,
  createJsonOutput,
  getDecision,
  getKeyMetrics,
  createMinimalJson,
} from '../src/json.js';
import {
  validateJsonOutput,
  validateVerificationResult,
  formatValidationErrors,
  JsonOutputSchema,
  VerificationResultSchema,
  ClauseResultSchema,
} from '../src/schema.js';
import {
  passingResult,
  failingResult,
  criticalResult,
  partialResult,
  emptyResult,
} from './fixtures.js';
import type { VerificationResult } from '../src/types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Decision Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('getDecision', () => {
  it('returns SHIP for passing result with score >= 95', () => {
    expect(getDecision(passingResult)).toBe('SHIP');
  });

  it('returns NO_SHIP for failing result', () => {
    expect(getDecision(failingResult)).toBe('NO_SHIP');
  });

  it('returns NO_SHIP for critical failures', () => {
    expect(getDecision(criticalResult)).toBe('NO_SHIP');
  });

  it('returns NO_SHIP for score < 95 even if success', () => {
    const result: VerificationResult = {
      ...passingResult,
      score: 90,
    };
    expect(getDecision(result)).toBe('NO_SHIP');
  });

  it('returns NO_SHIP for critical impact even with high score', () => {
    const result: VerificationResult = {
      ...passingResult,
      clauses: [
        ...passingResult.clauses,
        {
          name: 'critical_failure',
          status: 'failed',
          category: 'postcondition',
          impact: 'critical',
          duration: 10,
        },
      ],
    };
    expect(getDecision(result)).toBe('NO_SHIP');
  });

  it('returns SHIP for empty result', () => {
    expect(getDecision(emptyResult)).toBe('SHIP');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JSON Output Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('createJsonOutput', () => {
  it('creates valid JSON output structure', () => {
    const output = createJsonOutput(passingResult);

    expect(output.schemaVersion).toBe('1.0');
    expect(output.decision).toBe('SHIP');
    expect(output.result).toEqual(passingResult);
    expect(output.meta).toBeDefined();
    expect(output.meta.cliVersion).toBeDefined();
    expect(output.meta.nodeVersion).toBeDefined();
    expect(output.meta.platform).toBeDefined();
    expect(output.meta.timestamp).toBeDefined();
  });

  it('uses custom CLI version', () => {
    const output = createJsonOutput(passingResult, { cliVersion: '1.0.0' });
    expect(output.meta.cliVersion).toBe('1.0.0');
  });
});

describe('formatJson', () => {
  it('formats passing result as valid JSON', () => {
    const result = formatJson(passingResult);

    expect(result.valid).toBe(true);
    expect(result.errors).toBeUndefined();
    expect(result.output).toBeTruthy();

    const parsed = JSON.parse(result.output);
    expect(parsed.decision).toBe('SHIP');
  });

  it('formats failing result as valid JSON', () => {
    const result = formatJson(failingResult);

    expect(result.valid).toBe(true);

    const parsed = JSON.parse(result.output);
    expect(parsed.decision).toBe('NO_SHIP');
    expect(parsed.result.score).toBe(50);
  });

  it('produces pretty JSON by default', () => {
    const result = formatJson(passingResult);
    expect(result.output).toContain('\n');
    expect(result.output).toContain('  ');
  });

  it('produces compact JSON when pretty=false', () => {
    const result = formatJson(passingResult, { pretty: false });
    expect(result.output).not.toContain('\n');
  });

  it('validates output by default', () => {
    const result = formatJson(passingResult);
    expect(result.valid).toBe(true);
  });

  it('skips validation when validate=false', () => {
    const result = formatJson(passingResult, { validate: false });
    expect(result.valid).toBe(true);
  });
});

describe('parseJson', () => {
  it('parses valid JSON output', () => {
    const formatted = formatJson(passingResult);
    const parsed = parseJson(formatted.output);

    expect(parsed.success).toBe(true);
    expect(parsed.data).toBeDefined();
    expect(parsed.data?.decision).toBe('SHIP');
  });

  it('fails on invalid JSON', () => {
    const parsed = parseJson('not valid json');

    expect(parsed.success).toBe(false);
    expect(parsed.errors).toBeDefined();
    expect(parsed.errors?.[0]).toContain('JSON parse error');
  });

  it('fails on invalid schema', () => {
    const invalidJson = JSON.stringify({
      schemaVersion: '2.0', // Invalid version
      decision: 'MAYBE', // Invalid decision
    });

    const parsed = parseJson(invalidJson);

    expect(parsed.success).toBe(false);
    expect(parsed.errors).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Key Metrics Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('getKeyMetrics', () => {
  it('extracts metrics from passing result', () => {
    const metrics = getKeyMetrics(passingResult);

    expect(metrics.decision).toBe('SHIP');
    expect(metrics.score).toBe(100);
    expect(metrics.confidence).toBe(95);
    expect(metrics.passed).toBe(5);
    expect(metrics.failed).toBe(0);
    expect(metrics.total).toBe(5);
  });

  it('extracts metrics from failing result', () => {
    const metrics = getKeyMetrics(failingResult);

    expect(metrics.decision).toBe('NO_SHIP');
    expect(metrics.score).toBe(50);
    expect(metrics.passed).toBe(3);
    expect(metrics.failed).toBe(3);
    expect(metrics.total).toBe(6);
  });
});

describe('createMinimalJson', () => {
  it('creates minimal JSON output', () => {
    const minimal = createMinimalJson(passingResult);
    const parsed = JSON.parse(minimal);

    expect(parsed.decision).toBe('SHIP');
    expect(parsed.score).toBe(100);
    expect(parsed.passed).toBe(5);
    expect(parsed.failed).toBe(0);
    expect(Object.keys(parsed)).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('validateJsonOutput', () => {
  it('validates correct JSON output', () => {
    const output = createJsonOutput(passingResult);
    const result = validateJsonOutput(output);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('rejects invalid schema version', () => {
    const output = {
      ...createJsonOutput(passingResult),
      schemaVersion: '2.0',
    };
    const result = validateJsonOutput(output);

    expect(result.success).toBe(false);
  });

  it('rejects invalid decision', () => {
    const output = {
      ...createJsonOutput(passingResult),
      decision: 'MAYBE',
    };
    const result = validateJsonOutput(output);

    expect(result.success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const result = validateJsonOutput({
      schemaVersion: '1.0',
    });

    expect(result.success).toBe(false);
  });
});

describe('validateVerificationResult', () => {
  it('validates passing result', () => {
    const result = validateVerificationResult(passingResult);
    expect(result.success).toBe(true);
  });

  it('validates failing result', () => {
    const result = validateVerificationResult(failingResult);
    expect(result.success).toBe(true);
  });

  it('validates critical result', () => {
    const result = validateVerificationResult(criticalResult);
    expect(result.success).toBe(true);
  });

  it('rejects invalid score', () => {
    const invalid = {
      ...passingResult,
      score: 150, // Over 100
    };
    const result = validateVerificationResult(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects invalid recommendation', () => {
    const invalid = {
      ...passingResult,
      recommendation: 'invalid_recommendation',
    };
    const result = validateVerificationResult(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects negative duration', () => {
    const invalid = {
      ...passingResult,
      duration: -10,
    };
    const result = validateVerificationResult(invalid);
    expect(result.success).toBe(false);
  });
});

describe('ClauseResultSchema', () => {
  it('validates valid clause', () => {
    const clause = passingResult.clauses[0];
    const result = ClauseResultSchema.safeParse(clause);
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = ClauseResultSchema.safeParse({
      name: '',
      status: 'passed',
      category: 'postcondition',
      duration: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = ClauseResultSchema.safeParse({
      name: 'test',
      status: 'unknown',
      category: 'postcondition',
      duration: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = ClauseResultSchema.safeParse({
      name: 'test',
      status: 'passed',
      category: 'invalid',
      duration: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid impact', () => {
    const result = ClauseResultSchema.safeParse({
      name: 'test',
      status: 'failed',
      category: 'postcondition',
      impact: 'super_critical',
      duration: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe('formatValidationErrors', () => {
  it('formats validation errors as readable strings', () => {
    const result = validateJsonOutput({
      schemaVersion: '2.0',
      decision: 'MAYBE',
    });

    expect(result.success).toBe(false);
    if (result.errors) {
      const formatted = formatValidationErrors(result.errors);
      expect(Array.isArray(formatted)).toBe(true);
      expect(formatted.length).toBeGreaterThan(0);
      expect(typeof formatted[0]).toBe('string');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Round-trip Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('JSON round-trip', () => {
  it('preserves data through format -> parse cycle', () => {
    const formatted = formatJson(passingResult);
    const parsed = parseJson(formatted.output);

    expect(parsed.success).toBe(true);
    expect(parsed.data?.result.score).toBe(passingResult.score);
    expect(parsed.data?.result.clauses.length).toBe(passingResult.clauses.length);
  });

  it('preserves all fixtures through round-trip', () => {
    const fixtures = [passingResult, failingResult, criticalResult, partialResult, emptyResult];

    for (const fixture of fixtures) {
      const formatted = formatJson(fixture);
      expect(formatted.valid).toBe(true);

      const parsed = parseJson(formatted.output);
      expect(parsed.success).toBe(true);
      expect(parsed.data?.result.score).toBe(fixture.score);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Snapshot Tests for JSON Output
// ─────────────────────────────────────────────────────────────────────────────

describe('JSON output snapshots', () => {
  it('produces stable JSON structure for passing result', () => {
    const output = createJsonOutput(passingResult, { cliVersion: '0.1.0' });
    // Override dynamic fields for snapshot stability
    output.meta.nodeVersion = 'v20.0.0';
    output.meta.platform = 'linux';
    output.meta.timestamp = '2026-02-01T12:00:00.000Z';

    expect(output).toMatchSnapshot();
  });

  it('produces stable JSON structure for failing result', () => {
    const output = createJsonOutput(failingResult, { cliVersion: '0.1.0' });
    output.meta.nodeVersion = 'v20.0.0';
    output.meta.platform = 'linux';
    output.meta.timestamp = '2026-02-01T12:00:00.000Z';

    expect(output).toMatchSnapshot();
  });

  it('produces stable minimal JSON', () => {
    const minimal = createMinimalJson(passingResult);
    expect(minimal).toMatchSnapshot();
  });
});
