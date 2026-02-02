import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  serialize,
  deserialize,
  areEqual,
  diff,
  stripTimestamps,
} from '../src/serialize.js';
import type { EvidenceReport } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): EvidenceReport {
  const json = readFileSync(join(__dirname, `../fixtures/${name}`), 'utf-8');
  return JSON.parse(json);
}

describe('Evidence Serialization', () => {
  describe('serialize', () => {
    it('should produce deterministic output', () => {
      const report = loadFixture('valid-report.json');
      const output1 = serialize(report);
      const output2 = serialize(report);
      expect(output1).toBe(output2);
    });

    it('should sort keys alphabetically', () => {
      const report = loadFixture('valid-report.json');
      const output = serialize(report, { pretty: false });
      
      // Check that keys appear in alphabetical order
      // "assumptions" should come before "clauses"
      const assumptionsIndex = output.indexOf('"assumptions"');
      const clausesIndex = output.indexOf('"clauses"');
      expect(assumptionsIndex).toBeLessThan(clausesIndex);
    });

    it('should handle pretty printing option', () => {
      const report = loadFixture('valid-report.json');
      const pretty = serialize(report, { pretty: true });
      const compact = serialize(report, { pretty: false });
      
      expect(pretty).toContain('\n');
      expect(compact).not.toContain('\n');
    });

    it('should respect indent option', () => {
      const report = loadFixture('valid-report.json');
      const indent2 = serialize(report, { pretty: true, indent: 2 });
      const indent4 = serialize(report, { pretty: true, indent: 4 });
      
      expect(indent2).toContain('  "');
      expect(indent4).toContain('    "');
    });

    it('should produce identical output for reordered objects', () => {
      const report1: EvidenceReport = {
        schemaVersion: '1.0.0',
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
      };

      // Same data but different property order
      const report2 = {
        reproCommands: [],
        openQuestions: [],
        assumptions: [],
        clauses: [],
        metadata: {
          verifierVersion: '1.0.0',
          contractName: 'Test',
        },
        summary: {
          totalDurationMs: 0,
          passRate: 0,
          failedClauses: 0,
          partialClauses: 0,
          passedClauses: 0,
          totalClauses: 0,
        },
        verdict: 'SHIP',
        schemaVersion: '1.0.0',
      } as EvidenceReport;

      const output1 = serialize(report1, { pretty: false });
      const output2 = serialize(report2, { pretty: false });
      expect(output1).toBe(output2);
    });
  });

  describe('deserialize', () => {
    it('should round-trip correctly', () => {
      const original = loadFixture('valid-report.json');
      const serialized = serialize(original);
      const deserialized = deserialize(serialized);
      
      expect(deserialized.verdict).toBe(original.verdict);
      expect(deserialized.clauses.length).toBe(original.clauses.length);
    });

    it('should throw on invalid JSON', () => {
      expect(() => deserialize('not json')).toThrow();
    });
  });

  describe('areEqual', () => {
    it('should return true for identical reports', () => {
      const report = loadFixture('valid-report.json');
      expect(areEqual(report, report)).toBe(true);
    });

    it('should return true for semantically equal reports', () => {
      const report1 = loadFixture('valid-report.json');
      const report2 = JSON.parse(JSON.stringify(report1));
      expect(areEqual(report1, report2)).toBe(true);
    });

    it('should return false for different reports', () => {
      const report1 = loadFixture('valid-report.json');
      const report2 = loadFixture('failing-report.json');
      expect(areEqual(report1, report2)).toBe(false);
    });
  });

  describe('diff', () => {
    it('should detect verdict change', () => {
      const before = loadFixture('valid-report.json');
      const after = loadFixture('failing-report.json');
      const result = diff(before, after);
      
      expect(result.verdictChanged).toBe(true);
    });

    it('should detect clause changes', () => {
      const before = loadFixture('valid-report.json');
      const after: EvidenceReport = {
        ...before,
        clauses: [
          ...before.clauses,
          {
            id: 'new-clause',
            name: 'New clause',
            status: 'PASS',
            evidence: [],
          },
        ],
      };
      
      const result = diff(before, after);
      expect(result.clauseChanges).toHaveLength(1);
      expect(result.clauseChanges[0]?.type).toBe('added');
      expect(result.clauseChanges[0]?.id).toBe('new-clause');
    });

    it('should detect removed clauses', () => {
      const before = loadFixture('valid-report.json');
      const after: EvidenceReport = {
        ...before,
        clauses: before.clauses.slice(0, 1),
      };
      
      const result = diff(before, after);
      const removed = result.clauseChanges.filter((c) => c.type === 'removed');
      expect(removed.length).toBe(2);
    });

    it('should detect modified clauses', () => {
      const before = loadFixture('valid-report.json');
      const after: EvidenceReport = {
        ...before,
        clauses: before.clauses.map((c, i) =>
          i === 0 ? { ...c, status: 'FAIL' as const } : c
        ),
      };
      
      const result = diff(before, after);
      const modified = result.clauseChanges.find((c) => c.type === 'modified');
      expect(modified).toBeDefined();
      expect(modified?.before?.status).toBe('PASS');
      expect(modified?.after?.status).toBe('FAIL');
    });

    it('should detect pass rate changes', () => {
      const before = loadFixture('valid-report.json');
      const after: EvidenceReport = {
        ...before,
        summary: { ...before.summary, passRate: 50 },
      };
      
      const result = diff(before, after);
      expect(result.summaryChanges.passRate).toEqual({
        before: 100,
        after: 50,
      });
    });
  });

  describe('stripTimestamps', () => {
    it('should remove collectedAt from evidence items', () => {
      const report: EvidenceReport = {
        schemaVersion: '1.0.0',
        verdict: 'SHIP',
        summary: {
          totalClauses: 1,
          passedClauses: 1,
          partialClauses: 0,
          failedClauses: 0,
          passRate: 100,
          totalDurationMs: 50,
        },
        metadata: {
          contractName: 'Test',
          verifierVersion: '1.0.0',
        },
        clauses: [
          {
            id: 'clause-1',
            name: 'Test',
            status: 'PASS',
            evidence: [
              {
                type: 'assertion',
                description: 'Test evidence',
                collectedAt: '2024-01-15T10:30:00.000Z',
              },
            ],
          },
        ],
        assumptions: [],
        openQuestions: [],
        reproCommands: [],
      };

      const stripped = stripTimestamps(report);
      expect(stripped.clauses[0]?.evidence[0]?.collectedAt).toBeUndefined();
    });

    it('should preserve other evidence fields', () => {
      const report: EvidenceReport = {
        schemaVersion: '1.0.0',
        verdict: 'SHIP',
        summary: {
          totalClauses: 1,
          passedClauses: 1,
          partialClauses: 0,
          failedClauses: 0,
          passRate: 100,
          totalDurationMs: 50,
        },
        metadata: {
          contractName: 'Test',
          verifierVersion: '1.0.0',
        },
        clauses: [
          {
            id: 'clause-1',
            name: 'Test',
            status: 'PASS',
            evidence: [
              {
                type: 'assertion',
                description: 'Test evidence',
                location: { file: 'test.ts', line: 1 },
                collectedAt: '2024-01-15T10:30:00.000Z',
              },
            ],
          },
        ],
        assumptions: [],
        openQuestions: [],
        reproCommands: [],
      };

      const stripped = stripTimestamps(report);
      const evidence = stripped.clauses[0]?.evidence[0];
      expect(evidence?.type).toBe('assertion');
      expect(evidence?.description).toBe('Test evidence');
      expect(evidence?.location?.file).toBe('test.ts');
    });
  });
});
