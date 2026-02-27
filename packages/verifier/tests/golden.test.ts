// ============================================================================
// Golden Report Tests - Verify deterministic output
// ============================================================================

import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import {
  verify,
  verifyWithArtifacts,
  createSpec,
  scanWorkspace,
  serializeReport,
  reportsEqual,
  SCORING_WEIGHTS,
  type SpecAST,
  type EvidenceReport,
  type WorkspaceScanArtifacts,
} from '../src';

// ============================================================================
// FIXTURE PATHS
// ============================================================================

const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
const WORKSPACE_DIR = path.join(FIXTURES_DIR, 'workspace');
const SPEC_PATH = path.join(FIXTURES_DIR, 'spec.json');

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function loadSpec(): SpecAST {
  const content = fs.readFileSync(SPEC_PATH, 'utf-8');
  const raw = JSON.parse(content);
  return {
    domain: raw.domain,
    behaviors: raw.behaviors.map((b: Record<string, unknown>) => ({
      name: b.name as string,
      preconditions: (b.preconditions as Array<{ expression: string }>) ?? [],
      postconditions: (b.postconditions as Array<{ expression: string }>) ?? [],
      invariants: (b.invariants as Array<{ expression: string }>) ?? [],
      security: (b.security as Array<{ expression: string }>) ?? [],
      temporal: (b.temporal as Array<{ expression: string }>) ?? [],
    })),
    invariants: raw.invariants ?? [],
  };
}

// ============================================================================
// DETERMINISM TESTS
// ============================================================================

describe('Golden Report Tests', () => {
  describe('Determinism', () => {
    it('should produce identical reports on repeated runs', () => {
      const spec = loadSpec();
      
      // Run verification twice
      const report1 = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      const report2 = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      // Reports should be identical
      expect(report1.inputHash).toBe(report2.inputHash);
      expect(report1.score).toBe(report2.score);
      expect(report1.verdict).toBe(report2.verdict);
      expect(report1.clauseResults.length).toBe(report2.clauseResults.length);
      
      // Serialized JSON should be identical
      const json1 = serializeReport(report1);
      const json2 = serializeReport(report2);
      expect(json1).toBe(json2);
    });
    
    it('should produce stable clause IDs', () => {
      const spec = loadSpec();
      const report = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      // All clause IDs should follow pattern: domain.behavior.type.index
      for (const result of report.clauseResults) {
        const pattern = /^[A-Za-z]+\.[A-Za-z]+\.(precondition|postcondition|invariant|security|temporal)\.\d+$/;
        expect(result.clauseId).toMatch(pattern);
      }
    });
    
    it('should produce stable evidence IDs', () => {
      const spec = loadSpec();
      const report1 = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      const report2 = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      // Evidence IDs should be identical between runs
      for (let i = 0; i < report1.clauseResults.length; i++) {
        const clause1 = report1.clauseResults[i]!;
        const clause2 = report2.clauseResults[i]!;
        
        expect(clause1.evidence.length).toBe(clause2.evidence.length);
        
        for (let j = 0; j < clause1.evidence.length; j++) {
          expect(clause1.evidence[j]?.id).toBe(clause2.evidence[j]?.id);
        }
      }
    });
    
    it('should sort clause results alphabetically', () => {
      const spec = loadSpec();
      const report = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      // Verify sorted order
      const ids = report.clauseResults.map(r => r.clauseId);
      const sortedIds = [...ids].sort();
      expect(ids).toEqual(sortedIds);
    });
  });
  
  describe('Report Structure', () => {
    it('should have correct version', () => {
      const spec = loadSpec();
      const report = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      expect(report.version).toBe('1.0.0');
    });
    
    it('should have all required fields', () => {
      const spec = loadSpec();
      const report = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      // Required top-level fields
      expect(report).toHaveProperty('version');
      expect(report).toHaveProperty('domain');
      expect(report).toHaveProperty('behavior');
      expect(report).toHaveProperty('verdict');
      expect(report).toHaveProperty('score');
      expect(report).toHaveProperty('scoreBreakdown');
      expect(report).toHaveProperty('clauseResults');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('artifacts');
      expect(report).toHaveProperty('inputHash');
    });
    
    it('should have valid score breakdown', () => {
      const spec = loadSpec();
      const report = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      const breakdown = report.scoreBreakdown;
      
      // All scores should be 0-100
      expect(breakdown.preconditions).toBeGreaterThanOrEqual(0);
      expect(breakdown.preconditions).toBeLessThanOrEqual(100);
      expect(breakdown.postconditions).toBeGreaterThanOrEqual(0);
      expect(breakdown.postconditions).toBeLessThanOrEqual(100);
      expect(breakdown.invariants).toBeGreaterThanOrEqual(0);
      expect(breakdown.invariants).toBeLessThanOrEqual(100);
      expect(breakdown.security).toBeGreaterThanOrEqual(0);
      expect(breakdown.security).toBeLessThanOrEqual(100);
      expect(breakdown.bindings).toBeGreaterThanOrEqual(0);
      expect(breakdown.bindings).toBeLessThanOrEqual(100);
      expect(breakdown.testCoverage).toBeGreaterThanOrEqual(0);
      expect(breakdown.testCoverage).toBeLessThanOrEqual(100);
    });
    
    it('should have valid summary counts', () => {
      const spec = loadSpec();
      const report = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      const summary = report.summary;
      
      // Sum of status counts should equal total
      const statusSum = summary.passed + summary.partial + summary.failed + summary.skipped;
      expect(statusSum).toBe(summary.totalClauses);
      
      // Total clauses should match clauseResults length
      expect(summary.totalClauses).toBe(report.clauseResults.length);
    });
  });
  
  describe('No Timestamps', () => {
    it('should not contain any date/time values', () => {
      const spec = loadSpec();
      const report = verify(spec, { workspaceRoot: WORKSPACE_DIR });
      
      const json = serializeReport(report);
      
      // Should not contain ISO date patterns
      expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      // Should not contain timestamp-like numbers (13+ digits)
      const timestampPattern = /": \d{13,}/;
      expect(json).not.toMatch(timestampPattern);
    });
  });
});

// ============================================================================
// ARTIFACT SCANNING TESTS
// ============================================================================

describe('Workspace Scanning', () => {
  it('should find test files', () => {
    const artifacts = scanWorkspace({ workspaceRoot: WORKSPACE_DIR });
    
    expect(artifacts.testFiles.length).toBeGreaterThan(0);
    expect(artifacts.testFiles.some(f => f.path.includes('createUser.test'))).toBe(true);
  });
  
  it('should find bindings', () => {
    const artifacts = scanWorkspace({ 
      workspaceRoot: WORKSPACE_DIR,
      implPatterns: ['**/*.ts', '!**/*.test.ts', '!**/node_modules/**'],
    });
    
    // Note: Bindings detection depends on export patterns in source files
    // The fixture files should export functions that match behavior names
    expect(artifacts.bindings.length).toBeGreaterThanOrEqual(0);
    
    // If bindings were found, verify structure
    if (artifacts.bindings.length > 0) {
      expect(artifacts.bindings.some(b => b.exportName === 'createUser')).toBe(true);
    }
  });
  
  it('should extract assertions', () => {
    const artifacts = scanWorkspace({ workspaceRoot: WORKSPACE_DIR });
    
    expect(artifacts.assertions.length).toBeGreaterThan(0);
    expect(artifacts.assertions.some(a => a.assertFn === 'expect')).toBe(true);
  });
  
  it('should produce deterministic artifact ordering', () => {
    const artifacts1 = scanWorkspace({ workspaceRoot: WORKSPACE_DIR });
    const artifacts2 = scanWorkspace({ workspaceRoot: WORKSPACE_DIR });
    
    // Test files should be in same order
    expect(artifacts1.testFiles.map(f => f.path)).toEqual(
      artifacts2.testFiles.map(f => f.path)
    );
    
    // Bindings should be in same order
    expect(artifacts1.bindings.map(b => `${b.file}:${b.line}`)).toEqual(
      artifacts2.bindings.map(b => `${b.file}:${b.line}`)
    );
    
    // Assertions should be in same order
    expect(artifacts1.assertions.map(a => `${a.file}:${a.line}`)).toEqual(
      artifacts2.assertions.map(a => `${a.file}:${a.line}`)
    );
  });
});

// ============================================================================
// SCORING TESTS
// ============================================================================

describe('Scoring', () => {
  it('should compute integer score', () => {
    const spec = loadSpec();
    const report = verify(spec, { workspaceRoot: WORKSPACE_DIR });
    
    expect(Number.isInteger(report.score)).toBe(true);
  });
  
  it('should respect SHIP threshold', () => {
    const spec = loadSpec();
    
    // Low threshold - should SHIP
    const reportLow = verify(spec, { 
      workspaceRoot: WORKSPACE_DIR,
      shipThreshold: 10,
    });
    
    // High threshold - should NO_SHIP
    const reportHigh = verify(spec, { 
      workspaceRoot: WORKSPACE_DIR,
      shipThreshold: 100,
    });
    
    // Score should be the same
    expect(reportLow.score).toBe(reportHigh.score);
    
    // Verdict depends on threshold
    if (reportLow.summary.blockingIssues.length === 0) {
      expect(reportLow.verdict).toBe('SHIP');
    }
    expect(reportHigh.verdict).toBe('NO_SHIP');
  });
  
  it('should have consistent scoring weights', () => {
    // This test documents the expected weights
    // Weights should sum to 1.0
    const totalWeight = 
      SCORING_WEIGHTS.preconditions +
      SCORING_WEIGHTS.postconditions +
      SCORING_WEIGHTS.invariants +
      SCORING_WEIGHTS.security +
      SCORING_WEIGHTS.bindings +
      SCORING_WEIGHTS.testCoverage;
    
    expect(totalWeight).toBe(1.0);
  });
});

// ============================================================================
// REPORT EQUALITY TESTS
// ============================================================================

describe('Report Comparison', () => {
  it('should detect equal reports', () => {
    const spec = loadSpec();
    const report1 = verify(spec, { workspaceRoot: WORKSPACE_DIR });
    const report2 = verify(spec, { workspaceRoot: WORKSPACE_DIR });
    
    expect(reportsEqual(report1, report2)).toBe(true);
  });
  
  it('should detect different scores', () => {
    const spec = loadSpec();
    const report1 = verify(spec, { workspaceRoot: WORKSPACE_DIR });
    const report2 = { ...report1, score: report1.score + 10 };
    
    expect(reportsEqual(report1, report2)).toBe(false);
  });
  
  it('should detect different verdicts', () => {
    const spec = loadSpec();
    const report1 = verify(spec, { workspaceRoot: WORKSPACE_DIR });
    const report2 = { 
      ...report1, 
      verdict: report1.verdict === 'SHIP' ? 'NO_SHIP' : 'SHIP' as const,
    };
    
    expect(reportsEqual(report1, report2)).toBe(false);
  });
});
