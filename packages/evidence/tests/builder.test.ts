import { describe, it, expect } from 'vitest';
import {
  createReport,
  createClause,
  createEvidence,
  addClause,
  addAssumption,
  addOpenQuestion,
  addReproCommand,
  finalizeReport,
} from '../src/builder.js';

describe('Evidence Builder', () => {
  describe('createReport', () => {
    it('should create a new report with defaults', () => {
      const report = createReport({ contractName: 'TestContract' });
      
      expect(report.schemaVersion).toBe('1.0.0');
      expect(report.verdict).toBe('NO_SHIP');
      expect(report.metadata.contractName).toBe('TestContract');
      expect(report.clauses).toHaveLength(0);
      expect(report.summary.totalClauses).toBe(0);
    });

    it('should accept optional metadata', () => {
      const report = createReport({
        contractName: 'TestContract',
        contractFile: 'contracts/test.isl',
        gitCommit: 'abc123',
        gitBranch: 'main',
        buildId: 'build-1',
      });
      
      expect(report.metadata.contractFile).toBe('contracts/test.isl');
      expect(report.metadata.gitCommit).toBe('abc123');
      expect(report.metadata.gitBranch).toBe('main');
      expect(report.metadata.buildId).toBe('build-1');
    });
  });

  describe('createClause', () => {
    it('should create a clause with required fields', () => {
      const clause = createClause({
        id: 'clause-001',
        name: 'Test clause',
        status: 'PASS',
      });
      
      expect(clause.id).toBe('clause-001');
      expect(clause.name).toBe('Test clause');
      expect(clause.status).toBe('PASS');
      expect(clause.evidence).toHaveLength(0);
    });

    it('should accept optional fields', () => {
      const clause = createClause({
        id: 'clause-001',
        name: 'Test clause',
        status: 'FAIL',
        description: 'A failing clause',
        durationMs: 100,
        error: 'Something went wrong',
      });
      
      expect(clause.description).toBe('A failing clause');
      expect(clause.durationMs).toBe(100);
      expect(clause.error).toBe('Something went wrong');
    });
  });

  describe('createEvidence', () => {
    it('should create evidence with required fields', () => {
      const evidence = createEvidence({
        type: 'assertion',
        description: 'Value is correct',
      });
      
      expect(evidence.type).toBe('assertion');
      expect(evidence.description).toBe('Value is correct');
      expect(evidence.collectedAt).toBeDefined();
    });

    it('should accept location', () => {
      const evidence = createEvidence({
        type: 'postcondition',
        description: 'Status is 200',
        location: {
          file: 'src/api.ts',
          line: 42,
          snippet: 'return { status: 200 }',
        },
      });
      
      expect(evidence.location?.file).toBe('src/api.ts');
      expect(evidence.location?.line).toBe(42);
      expect(evidence.location?.snippet).toBe('return { status: 200 }');
    });
  });

  describe('addClause', () => {
    it('should add clause and update summary', () => {
      let report = createReport({ contractName: 'Test' });
      const clause = createClause({
        id: 'c1',
        name: 'Clause 1',
        status: 'PASS',
        durationMs: 50,
      });
      
      report = addClause(report, clause);
      
      expect(report.clauses).toHaveLength(1);
      expect(report.summary.totalClauses).toBe(1);
      expect(report.summary.passedClauses).toBe(1);
      expect(report.summary.passRate).toBe(100);
      expect(report.verdict).toBe('SHIP');
    });

    it('should set NO_SHIP for failing clause', () => {
      let report = createReport({ contractName: 'Test' });
      const clause = createClause({
        id: 'c1',
        name: 'Clause 1',
        status: 'FAIL',
      });
      
      report = addClause(report, clause);
      
      expect(report.verdict).toBe('NO_SHIP');
      expect(report.summary.failedClauses).toBe(1);
    });

    it('should set NO_SHIP for partial clause', () => {
      let report = createReport({ contractName: 'Test' });
      const clause = createClause({
        id: 'c1',
        name: 'Clause 1',
        status: 'PARTIAL',
      });
      
      report = addClause(report, clause);
      
      expect(report.verdict).toBe('NO_SHIP');
      expect(report.summary.partialClauses).toBe(1);
    });

    it('should accumulate duration', () => {
      let report = createReport({ contractName: 'Test' });
      
      report = addClause(
        report,
        createClause({ id: 'c1', name: 'C1', status: 'PASS', durationMs: 50 })
      );
      report = addClause(
        report,
        createClause({ id: 'c2', name: 'C2', status: 'PASS', durationMs: 75 })
      );
      
      expect(report.summary.totalDurationMs).toBe(125);
    });
  });

  describe('addAssumption', () => {
    it('should add assumption to report', () => {
      let report = createReport({ contractName: 'Test' });
      
      report = addAssumption(report, {
        id: 'assume-1',
        description: 'Database is available',
        risk: 'low',
      });
      
      expect(report.assumptions).toHaveLength(1);
      expect(report.assumptions[0]?.description).toBe('Database is available');
    });
  });

  describe('addOpenQuestion', () => {
    it('should add question to report', () => {
      let report = createReport({ contractName: 'Test' });
      
      report = addOpenQuestion(report, {
        id: 'q-1',
        question: 'Should we support pagination?',
        priority: 'medium',
      });
      
      expect(report.openQuestions).toHaveLength(1);
      expect(report.openQuestions[0]?.question).toBe('Should we support pagination?');
    });
  });

  describe('addReproCommand', () => {
    it('should add command to report', () => {
      let report = createReport({ contractName: 'Test' });
      
      report = addReproCommand(report, {
        description: 'Run tests',
        command: 'pnpm test',
      });
      
      expect(report.reproCommands).toHaveLength(1);
      expect(report.reproCommands[0]?.command).toBe('pnpm test');
    });
  });

  describe('finalizeReport', () => {
    it('should compute correct summary for mixed results', () => {
      let report = createReport({ contractName: 'Test' });
      report.clauses = [
        createClause({ id: 'c1', name: 'C1', status: 'PASS', durationMs: 10 }),
        createClause({ id: 'c2', name: 'C2', status: 'PASS', durationMs: 20 }),
        createClause({ id: 'c3', name: 'C3', status: 'PARTIAL', durationMs: 30 }),
        createClause({ id: 'c4', name: 'C4', status: 'FAIL', durationMs: 40 }),
      ];
      
      report = finalizeReport(report);
      
      expect(report.summary.totalClauses).toBe(4);
      expect(report.summary.passedClauses).toBe(2);
      expect(report.summary.partialClauses).toBe(1);
      expect(report.summary.failedClauses).toBe(1);
      expect(report.summary.passRate).toBe(50);
      expect(report.summary.totalDurationMs).toBe(100);
      expect(report.verdict).toBe('NO_SHIP');
    });

    it('should return SHIP for all passing', () => {
      let report = createReport({ contractName: 'Test' });
      report.clauses = [
        createClause({ id: 'c1', name: 'C1', status: 'PASS' }),
        createClause({ id: 'c2', name: 'C2', status: 'PASS' }),
      ];
      
      report = finalizeReport(report);
      
      expect(report.verdict).toBe('SHIP');
      expect(report.summary.passRate).toBe(100);
    });
  });
});
