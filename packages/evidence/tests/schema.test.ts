import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validateEvidenceReport,
  safeValidateEvidenceReport,
  EvidenceReportSchema,
  ClauseResultSchema,
  SourceLocationSchema,
  VerdictSchema,
  ClauseStatusSchema,
} from '../src/schema.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('Evidence Schema Validation', () => {
  describe('VerdictSchema', () => {
    it('should accept SHIP', () => {
      expect(VerdictSchema.parse('SHIP')).toBe('SHIP');
    });

    it('should accept NO_SHIP', () => {
      expect(VerdictSchema.parse('NO_SHIP')).toBe('NO_SHIP');
    });

    it('should reject invalid values', () => {
      expect(() => VerdictSchema.parse('MAYBE')).toThrow();
      expect(() => VerdictSchema.parse('')).toThrow();
      expect(() => VerdictSchema.parse(null)).toThrow();
    });
  });

  describe('ClauseStatusSchema', () => {
    it('should accept PASS', () => {
      expect(ClauseStatusSchema.parse('PASS')).toBe('PASS');
    });

    it('should accept PARTIAL', () => {
      expect(ClauseStatusSchema.parse('PARTIAL')).toBe('PARTIAL');
    });

    it('should accept FAIL', () => {
      expect(ClauseStatusSchema.parse('FAIL')).toBe('FAIL');
    });

    it('should reject invalid values', () => {
      expect(() => ClauseStatusSchema.parse('SKIP')).toThrow();
      expect(() => ClauseStatusSchema.parse('pass')).toThrow();
    });
  });

  describe('SourceLocationSchema', () => {
    it('should accept valid location with required fields', () => {
      const location = { file: 'src/index.ts', line: 42 };
      expect(SourceLocationSchema.parse(location)).toEqual(location);
    });

    it('should accept location with optional fields', () => {
      const location = {
        file: 'src/index.ts',
        line: 42,
        column: 10,
        snippet: 'const x = 1;',
      };
      expect(SourceLocationSchema.parse(location)).toEqual(location);
    });

    it('should reject empty file', () => {
      expect(() => SourceLocationSchema.parse({ file: '', line: 1 })).toThrow();
    });

    it('should reject non-positive line', () => {
      expect(() => SourceLocationSchema.parse({ file: 'x.ts', line: 0 })).toThrow();
      expect(() => SourceLocationSchema.parse({ file: 'x.ts', line: -1 })).toThrow();
    });

    it('should reject non-integer line', () => {
      expect(() => SourceLocationSchema.parse({ file: 'x.ts', line: 1.5 })).toThrow();
    });
  });

  describe('ClauseResultSchema', () => {
    it('should accept valid clause with required fields', () => {
      const clause = {
        id: 'clause-001',
        name: 'Test clause',
        status: 'PASS',
        evidence: [],
      };
      expect(ClauseResultSchema.parse(clause)).toEqual(clause);
    });

    it('should accept clause with all fields', () => {
      const clause = {
        id: 'clause-001',
        name: 'Test clause',
        status: 'FAIL',
        description: 'A test clause',
        evidence: [
          {
            type: 'assertion',
            description: 'Value is correct',
          },
        ],
        durationMs: 100,
        error: 'Something went wrong',
      };
      expect(ClauseResultSchema.parse(clause)).toEqual(clause);
    });

    it('should reject empty id', () => {
      expect(() =>
        ClauseResultSchema.parse({
          id: '',
          name: 'Test',
          status: 'PASS',
          evidence: [],
        })
      ).toThrow();
    });

    it('should reject empty name', () => {
      expect(() =>
        ClauseResultSchema.parse({
          id: 'id',
          name: '',
          status: 'PASS',
          evidence: [],
        })
      ).toThrow();
    });
  });

  describe('EvidenceReportSchema', () => {
    it('should validate valid-report.json fixture', () => {
      const json = readFileSync(
        join(__dirname, '../fixtures/valid-report.json'),
        'utf-8'
      );
      const data = JSON.parse(json);
      const result = validateEvidenceReport(data);
      expect(result.verdict).toBe('SHIP');
      expect(result.summary.passRate).toBe(100);
      expect(result.clauses).toHaveLength(3);
    });

    it('should validate failing-report.json fixture', () => {
      const json = readFileSync(
        join(__dirname, '../fixtures/failing-report.json'),
        'utf-8'
      );
      const data = JSON.parse(json);
      const result = validateEvidenceReport(data);
      expect(result.verdict).toBe('NO_SHIP');
      expect(result.summary.failedClauses).toBe(1);
      expect(result.openQuestions).toHaveLength(2);
    });

    it('should reject report with wrong schema version', () => {
      expect(() =>
        EvidenceReportSchema.parse({
          schemaVersion: '2.0.0',
          verdict: 'SHIP',
          summary: {
            totalClauses: 0,
            passedClauses: 0,
            partialClauses: 0,
            failedClauses: 0,
            passRate: 0,
            totalDurationMs: 0,
          },
          metadata: {
            contractName: 'Test',
            verifierVersion: '1.0.0',
          },
          clauses: [],
          assumptions: [],
          openQuestions: [],
          reproCommands: [],
        })
      ).toThrow();
    });

    it('should reject report missing required fields', () => {
      expect(() =>
        EvidenceReportSchema.parse({
          schemaVersion: '1.0.0',
          verdict: 'SHIP',
        })
      ).toThrow();
    });

    it('should reject invalid pass rate (> 100)', () => {
      expect(() =>
        EvidenceReportSchema.parse({
          schemaVersion: '1.0.0',
          verdict: 'SHIP',
          summary: {
            totalClauses: 1,
            passedClauses: 1,
            partialClauses: 0,
            failedClauses: 0,
            passRate: 150,
            totalDurationMs: 0,
          },
          metadata: {
            contractName: 'Test',
            verifierVersion: '1.0.0',
          },
          clauses: [],
          assumptions: [],
          openQuestions: [],
          reproCommands: [],
        })
      ).toThrow();
    });
  });

  describe('safeValidateEvidenceReport', () => {
    it('should return success for valid data', () => {
      const json = readFileSync(
        join(__dirname, '../fixtures/valid-report.json'),
        'utf-8'
      );
      const data = JSON.parse(json);
      const result = safeValidateEvidenceReport(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.verdict).toBe('SHIP');
      }
    });

    it('should return error for invalid data', () => {
      const result = safeValidateEvidenceReport({ invalid: true });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});
