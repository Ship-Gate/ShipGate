import { describe, it, expect } from 'vitest';
import {
  validateEvidenceReport,
  isValidEvidenceReport,
  parseEvidenceReport,
  safeParseEvidenceReport,
  createMinimalEvidenceReport,
  EvidenceReportSchema,
} from '../index.js';
import type { EvidenceReport, EvidenceClauseResult, Assumption, OpenQuestion, EvidenceArtifact } from '../index.js';

/**
 * Helper to create a valid evidence report for testing
 */
function createValidReport(overrides: Partial<EvidenceReport> = {}): EvidenceReport {
  const now = new Date().toISOString();
  return {
    version: '1.0',
    reportId: 'test-report-001',
    specFingerprint: 'sha256:abc123def456',
    specName: 'TestSpec',
    specPath: '/specs/test.isl',
    clauseResults: [
      {
        clauseId: 'clause-1',
        state: 'PASS',
        message: 'Passed successfully',
        clauseType: 'precondition',
      },
      {
        clauseId: 'clause-2',
        state: 'PARTIAL',
        message: 'Partially met',
        clauseType: 'postcondition',
      },
      {
        clauseId: 'clause-3',
        state: 'FAIL',
        message: 'Failed validation',
        clauseType: 'invariant',
      },
    ],
    scoreSummary: {
      overallScore: 50,
      passCount: 1,
      partialCount: 1,
      failCount: 1,
      totalClauses: 3,
      passRate: 33.33,
      confidence: 'medium',
      recommendation: 'review',
    },
    assumptions: [
      {
        id: 'assumption-1',
        description: 'User is authenticated',
        category: 'input',
        impact: 'high',
        relatedClauses: ['clause-1'],
      },
    ],
    openQuestions: [
      {
        id: 'question-1',
        question: 'Should we handle edge case X?',
        priority: 'medium',
        context: 'Found during testing',
        relatedClauses: ['clause-3'],
        suggestedActions: ['Review with team', 'Add test case'],
      },
    ],
    artifacts: [
      {
        id: 'artifact-1',
        type: 'trace',
        name: 'execution-trace',
        location: '/traces/test-001.json',
        mimeType: 'application/json',
        createdAt: now,
      },
      {
        id: 'artifact-2',
        type: 'test',
        name: 'generated-test',
        content: 'test("should work", () => { expect(true).toBe(true); })',
        mimeType: 'text/typescript',
        size: 52,
        createdAt: now,
      },
    ],
    metadata: {
      startedAt: now,
      completedAt: now,
      durationMs: 1234,
      agentVersion: '1.0.0',
      environment: 'test',
      mode: 'full',
    },
    notes: 'Test report for validation',
    ...overrides,
  };
}

describe('Evidence Report Schema', () => {
  describe('validateEvidenceReport', () => {
    it('should validate a complete valid report', () => {
      const report = createValidReport();
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a minimal valid report', () => {
      const report = createMinimalEvidenceReport();
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject report with missing version', () => {
      const report = createValidReport();
      // @ts-expect-error - testing invalid input
      delete report.version;
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('version'))).toBe(true);
    });

    it('should reject report with invalid version', () => {
      const report = createValidReport();
      // @ts-expect-error - testing invalid input
      report.version = '2.0';
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('version'))).toBe(true);
    });

    it('should reject report with empty specFingerprint', () => {
      const report = createValidReport({ specFingerprint: '' });
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('fingerprint'))).toBe(true);
    });

    it('should reject report with mismatched clause counts', () => {
      const report = createValidReport();
      report.scoreSummary.totalClauses = 5; // Mismatch with clauseResults.length (3)
      report.scoreSummary.passCount = 3; // Adjust to sum to 5
      report.scoreSummary.partialCount = 1;
      report.scoreSummary.failCount = 1;

      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
    });

    it('should reject report with invalid clause state', () => {
      const report = createValidReport();
      // @ts-expect-error - testing invalid input
      report.clauseResults[0].state = 'INVALID';
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('state'))).toBe(true);
    });

    it('should reject report with score out of range', () => {
      const report = createValidReport();
      report.scoreSummary.overallScore = 150;
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('overallScore'))).toBe(true);
    });

    it('should reject report with negative counts', () => {
      const report = createValidReport();
      report.scoreSummary.passCount = -1;
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
    });

    it('should reject report with invalid datetime', () => {
      const report = createValidReport();
      report.metadata.startedAt = 'not-a-date';
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('datetime'))).toBe(true);
    });

    it('should reject report where completedAt is before startedAt', () => {
      const report = createValidReport();
      report.metadata.startedAt = '2024-01-02T00:00:00.000Z';
      report.metadata.completedAt = '2024-01-01T00:00:00.000Z';
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes('completedAt'))).toBe(true);
    });

    it('should reject non-object input', () => {
      const result = validateEvidenceReport('not an object');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject null input', () => {
      const result = validateEvidenceReport(null);

      expect(result.valid).toBe(false);
    });

    it('should reject undefined input', () => {
      const result = validateEvidenceReport(undefined);

      expect(result.valid).toBe(false);
    });
  });

  describe('isValidEvidenceReport', () => {
    it('should return true for valid report', () => {
      const report = createValidReport();
      expect(isValidEvidenceReport(report)).toBe(true);
    });

    it('should return false for invalid report', () => {
      expect(isValidEvidenceReport({})).toBe(false);
    });

    it('should work as type guard', () => {
      const maybeReport: unknown = createValidReport();

      if (isValidEvidenceReport(maybeReport)) {
        // TypeScript should recognize this as EvidenceReport
        expect(maybeReport.specFingerprint).toBeDefined();
        expect(maybeReport.clauseResults).toBeInstanceOf(Array);
      }
    });
  });

  describe('parseEvidenceReport', () => {
    it('should return typed report for valid input', () => {
      const report = createValidReport();
      const parsed = parseEvidenceReport(report);

      expect(parsed.version).toBe('1.0');
      expect(parsed.specFingerprint).toBe(report.specFingerprint);
    });

    it('should throw for invalid input', () => {
      expect(() => parseEvidenceReport({})).toThrow();
    });
  });

  describe('safeParseEvidenceReport', () => {
    it('should return success result for valid input', () => {
      const report = createValidReport();
      const result = safeParseEvidenceReport(report);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.specFingerprint).toBe(report.specFingerprint);
      }
    });

    it('should return error result for invalid input', () => {
      const result = safeParseEvidenceReport({});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.valid).toBe(false);
        expect(result.error.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('createMinimalEvidenceReport', () => {
    it('should create a valid report with defaults', () => {
      const report = createMinimalEvidenceReport();
      const result = validateEvidenceReport(report);

      expect(result.valid).toBe(true);
      expect(report.version).toBe('1.0');
      expect(report.clauseResults).toHaveLength(0);
      expect(report.scoreSummary.totalClauses).toBe(0);
    });

    it('should allow overriding specific fields', () => {
      const report = createMinimalEvidenceReport({
        specFingerprint: 'custom-fingerprint',
        specName: 'CustomSpec',
      });

      expect(report.specFingerprint).toBe('custom-fingerprint');
      expect(report.specName).toBe('CustomSpec');
    });

    it('should allow overriding nested scoreSummary fields', () => {
      const report = createMinimalEvidenceReport({
        scoreSummary: {
          overallScore: 75,
          passCount: 0,
          partialCount: 0,
          failCount: 0,
          totalClauses: 0,
          passRate: 75,
          confidence: 'medium',
          recommendation: 'review',
        },
      });

      expect(report.scoreSummary.overallScore).toBe(75);
      expect(report.scoreSummary.confidence).toBe('medium');
    });
  });

  describe('Schema components', () => {
    describe('EvidenceClauseResult', () => {
      it('should validate all clause types', () => {
        const clauseTypes = ['precondition', 'postcondition', 'invariant', 'effect', 'constraint'];

        for (const clauseType of clauseTypes) {
          const report = createMinimalEvidenceReport({
            clauseResults: [
              {
                clauseId: 'test',
                state: 'PASS',
                clauseType: clauseType as EvidenceClauseResult['clauseType'],
              },
            ],
            scoreSummary: {
              overallScore: 100,
              passCount: 1,
              partialCount: 0,
              failCount: 0,
              totalClauses: 1,
              passRate: 100,
              confidence: 'high',
              recommendation: 'ship',
            },
          });

          expect(validateEvidenceReport(report).valid).toBe(true);
        }
      });

      it('should allow optional fields', () => {
        const report = createMinimalEvidenceReport({
          clauseResults: [
            {
              clauseId: 'minimal-clause',
              state: 'PASS',
            },
          ],
          scoreSummary: {
            overallScore: 100,
            passCount: 1,
            partialCount: 0,
            failCount: 0,
            totalClauses: 1,
            passRate: 100,
            confidence: 'high',
            recommendation: 'ship',
          },
        });

        expect(validateEvidenceReport(report).valid).toBe(true);
      });

      it('should validate evaluationTimeMs as non-negative integer', () => {
        const report = createMinimalEvidenceReport({
          clauseResults: [
            {
              clauseId: 'test',
              state: 'PASS',
              evaluationTimeMs: 100,
            },
          ],
          scoreSummary: {
            overallScore: 100,
            passCount: 1,
            partialCount: 0,
            failCount: 0,
            totalClauses: 1,
            passRate: 100,
            confidence: 'high',
            recommendation: 'ship',
          },
        });

        expect(validateEvidenceReport(report).valid).toBe(true);
      });
    });

    describe('Assumption', () => {
      it('should validate all assumption categories', () => {
        const categories = ['input', 'environment', 'dependency', 'timing', 'other'];

        for (const category of categories) {
          const assumption: Assumption = {
            id: 'test',
            description: 'Test assumption',
            category: category as Assumption['category'],
            impact: 'medium',
          };

          const report = createMinimalEvidenceReport({
            assumptions: [assumption],
          });

          expect(validateEvidenceReport(report).valid).toBe(true);
        }
      });

      it('should validate all impact levels', () => {
        const impacts = ['low', 'medium', 'high', 'critical'];

        for (const impact of impacts) {
          const assumption: Assumption = {
            id: 'test',
            description: 'Test assumption',
            category: 'input',
            impact: impact as Assumption['impact'],
          };

          const report = createMinimalEvidenceReport({
            assumptions: [assumption],
          });

          expect(validateEvidenceReport(report).valid).toBe(true);
        }
      });
    });

    describe('OpenQuestion', () => {
      it('should validate all priority levels', () => {
        const priorities = ['low', 'medium', 'high'];

        for (const priority of priorities) {
          const question: OpenQuestion = {
            id: 'test',
            question: 'Test question?',
            priority: priority as OpenQuestion['priority'],
          };

          const report = createMinimalEvidenceReport({
            openQuestions: [question],
          });

          expect(validateEvidenceReport(report).valid).toBe(true);
        }
      });
    });

    describe('EvidenceArtifact', () => {
      it('should validate all artifact types', () => {
        const types = ['binding', 'test', 'trace', 'log', 'snapshot'];

        for (const type of types) {
          const artifact: EvidenceArtifact = {
            id: 'test',
            type: type as EvidenceArtifact['type'],
            name: 'Test artifact',
            createdAt: new Date().toISOString(),
          };

          const report = createMinimalEvidenceReport({
            artifacts: [artifact],
          });

          expect(validateEvidenceReport(report).valid).toBe(true);
        }
      });

      it('should allow both location and content', () => {
        const artifact: EvidenceArtifact = {
          id: 'test',
          type: 'trace',
          name: 'Test artifact',
          location: '/path/to/file',
          content: 'inline content',
          mimeType: 'text/plain',
          size: 14,
          createdAt: new Date().toISOString(),
          metadata: { key: 'value' },
        };

        const report = createMinimalEvidenceReport({
          artifacts: [artifact],
        });

        expect(validateEvidenceReport(report).valid).toBe(true);
      });
    });

    describe('ScoreSummary validation', () => {
      it('should reject when counts do not sum to total', () => {
        const report = createMinimalEvidenceReport({
          scoreSummary: {
            overallScore: 50,
            passCount: 1,
            partialCount: 1,
            failCount: 1,
            totalClauses: 5, // Should be 3
            passRate: 33,
            confidence: 'medium',
            recommendation: 'review',
          },
        });

        expect(validateEvidenceReport(report).valid).toBe(false);
      });

      it('should validate all confidence levels', () => {
        const levels = ['low', 'medium', 'high'];

        for (const confidence of levels) {
          const report = createMinimalEvidenceReport({
            scoreSummary: {
              overallScore: 50,
              passCount: 0,
              partialCount: 0,
              failCount: 0,
              totalClauses: 0,
              passRate: 0,
              confidence: confidence as ScoreSummary['confidence'],
              recommendation: 'review',
            },
          });

          expect(validateEvidenceReport(report).valid).toBe(true);
        }
      });

      it('should validate all recommendations', () => {
        const recommendations = ['ship', 'review', 'block'];

        for (const recommendation of recommendations) {
          const report = createMinimalEvidenceReport({
            scoreSummary: {
              overallScore: 50,
              passCount: 0,
              partialCount: 0,
              failCount: 0,
              totalClauses: 0,
              passRate: 0,
              confidence: 'medium',
              recommendation: recommendation as ScoreSummary['recommendation'],
            },
          });

          expect(validateEvidenceReport(report).valid).toBe(true);
        }
      });
    });

    describe('VerificationMetadata', () => {
      it('should validate all verification modes', () => {
        const modes = ['full', 'incremental', 'quick'];

        for (const mode of modes) {
          const now = new Date().toISOString();
          const report = createMinimalEvidenceReport({
            metadata: {
              startedAt: now,
              completedAt: now,
              durationMs: 100,
              agentVersion: '1.0.0',
              mode: mode as VerificationMetadata['mode'],
            },
          });

          expect(validateEvidenceReport(report).valid).toBe(true);
        }
      });
    });
  });
});

// Import type for ScoreSummary and VerificationMetadata
import type { ScoreSummary, VerificationMetadata } from '../index.js';
