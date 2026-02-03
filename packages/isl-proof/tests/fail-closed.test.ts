/**
 * Integration Tests for Fail-Closed Proof Bundle Verification
 * 
 * Tests the fail-closed verification rules:
 * - PROVEN requires: gate SHIP + verify PROVEN + tests > 0 + imports resolved + stdlib versions recorded
 * - If tests == 0 or any clause unknown => INCOMPLETE_PROOF
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  calculateVerdictV2,
  type ManifestGateResult,
  type BuildResult,
  type TestResult,
  type VerifyResults,
  type ImportGraph,
  type StdlibVersion,
  type ProofBundleManifest,
} from '../src/manifest.js';

// Note: verifyProof import is conditional to avoid dependency issues in test environment
// The integration tests below test the calculation logic directly

// ============================================================================
// Test Fixtures
// ============================================================================

const createGateResult = (overrides: Partial<ManifestGateResult> = {}): ManifestGateResult => ({
  verdict: 'SHIP',
  score: 100,
  fingerprint: 'test-fingerprint',
  blockers: 0,
  warnings: 0,
  violations: [],
  policyBundleVersion: '1.0.0',
  rulepackVersions: [{ id: 'auth', version: '1.0.0', rulesCount: 5 }],
  timestamp: new Date().toISOString(),
  ...overrides,
});

const createBuildResult = (overrides: Partial<BuildResult> = {}): BuildResult => ({
  tool: 'tsc',
  toolVersion: '5.3.0',
  status: 'pass',
  errorCount: 0,
  warningCount: 0,
  durationMs: 1000,
  timestamp: new Date().toISOString(),
  ...overrides,
});

const createTestResult = (overrides: Partial<TestResult> = {}): TestResult => ({
  framework: 'vitest',
  frameworkVersion: '1.2.0',
  status: 'pass',
  totalTests: 10,
  passedTests: 10,
  failedTests: 0,
  skippedTests: 0,
  durationMs: 2000,
  timestamp: new Date().toISOString(),
  ...overrides,
});

const createVerifyResults = (overrides: Partial<VerifyResults> = {}): VerifyResults => ({
  verdict: 'PROVEN',
  clauses: [
    {
      clauseId: 'test_postcondition_1',
      clauseType: 'postcondition',
      behavior: 'authenticate',
      status: 'proven',
      traceIds: ['trace-1'],
    },
  ],
  summary: {
    totalClauses: 1,
    provenClauses: 1,
    notProvenClauses: 0,
    unknownClauses: 0,
    violatedClauses: 0,
  },
  durationMs: 100,
  timestamp: new Date().toISOString(),
  ...overrides,
});

const createImportGraph = (overrides: Partial<ImportGraph> = {}): ImportGraph => ({
  imports: [
    {
      importPath: '@isl/auth',
      resolvedPath: '/stdlib/auth.isl',
      resolved: true,
      moduleType: 'stdlib',
    },
  ],
  graphHash: 'test-hash',
  allResolved: true,
  unresolvedCount: 0,
  ...overrides,
});

const createStdlibVersions = (): StdlibVersion[] => [
  {
    module: '@isl/auth',
    version: '1.0.0',
    contentHash: 'abc123',
  },
];

// ============================================================================
// Fail-Closed Verdict Tests
// ============================================================================

describe('calculateVerdictV2 - Fail-Closed Rules', () => {
  describe('Rule: tests > 0 required for PROVEN', () => {
    it('returns INCOMPLETE_PROOF when tests == 0', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ 
          status: 'no_tests', 
          totalTests: 0, 
          passedTests: 0 
        }),
      });

      expect(result.verdict).toBe('INCOMPLETE_PROOF');
      expect(result.reason).toContain('testCount = 0');
      expect(result.details).toContain('✗ Tests: 0 tests (fail-closed: tests required for PROVEN)');
    });

    it('returns PROVEN when tests > 0', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ 
          status: 'pass', 
          totalTests: 5, 
          passedTests: 5 
        }),
      });

      expect(result.verdict).toBe('PROVEN');
    });

    it('returns PROVEN when tests == 0 but noTestsRequired declared', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ 
          status: 'no_tests', 
          totalTests: 0 
        }),
        testDeclaration: { 
          noTestsRequired: true, 
          reason: 'utility library with no behavior' 
        },
      });

      expect(result.verdict).toBe('PROVEN');
      // V2 uses a unified success message - the details contain the specific info
      expect(result.details).toContain('✓ Tests: none required (utility library with no behavior)');
    });
  });

  describe('Rule: gate SHIP required for PROVEN', () => {
    it('returns VIOLATED when gate is NO_SHIP', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ 
          verdict: 'NO_SHIP', 
          score: 40, 
          blockers: 3 
        }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 10 }),
      });

      expect(result.verdict).toBe('VIOLATED');
      expect(result.reason).toContain('NO_SHIP');
    });
  });

  describe('Rule: verify PROVEN required (when provided)', () => {
    it('returns VIOLATED when verify verdict is VIOLATED', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 10 }),
        verifyResults: createVerifyResults({
          verdict: 'VIOLATED',
          summary: {
            totalClauses: 2,
            provenClauses: 1,
            notProvenClauses: 0,
            unknownClauses: 0,
            violatedClauses: 1,
          },
        }),
      });

      expect(result.verdict).toBe('VIOLATED');
      expect(result.reason).toContain('violated');
    });

    it('returns INCOMPLETE_PROOF when verify has unknown clauses (fail-closed)', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 10 }),
        verifyResults: createVerifyResults({
          verdict: 'NOT_PROVEN',
          clauses: [
            {
              clauseId: 'test_postcondition_1',
              clauseType: 'postcondition',
              status: 'unknown',
              traceIds: [],
            },
          ],
          summary: {
            totalClauses: 1,
            provenClauses: 0,
            notProvenClauses: 0,
            unknownClauses: 1,
            violatedClauses: 0,
          },
        }),
      });

      expect(result.verdict).toBe('INCOMPLETE_PROOF');
      expect(result.reason).toContain('unknown');
      expect(result.reason).toContain('fail-closed');
    });

    it('returns PROVEN when verify verdict is PROVEN with no unknowns', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 10 }),
        verifyResults: createVerifyResults({
          verdict: 'PROVEN',
          summary: {
            totalClauses: 3,
            provenClauses: 3,
            notProvenClauses: 0,
            unknownClauses: 0,
            violatedClauses: 0,
          },
        }),
      });

      expect(result.verdict).toBe('PROVEN');
    });
  });

  describe('Rule: imports must be resolved (when provided)', () => {
    it('returns INCOMPLETE_PROOF when imports are unresolved', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 10 }),
        importGraph: createImportGraph({
          imports: [
            {
              importPath: '@isl/unknown-module',
              resolvedPath: '',
              resolved: false,
              error: 'Module not found',
              moduleType: 'stdlib',
            },
          ],
          allResolved: false,
          unresolvedCount: 1,
        }),
      });

      expect(result.verdict).toBe('INCOMPLETE_PROOF');
      expect(result.reason).toContain('unresolved');
    });

    it('returns PROVEN when all imports are resolved', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 10 }),
        importGraph: createImportGraph({
          allResolved: true,
          unresolvedCount: 0,
        }),
        stdlibVersions: createStdlibVersions(),
      });

      expect(result.verdict).toBe('PROVEN');
    });
  });

  describe('Rule: stdlib versions must be recorded (when stdlib imports exist)', () => {
    it('returns INCOMPLETE_PROOF when stdlib imports exist but versions not recorded', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 10 }),
        importGraph: createImportGraph({
          imports: [
            {
              importPath: '@isl/auth',
              resolvedPath: '/stdlib/auth.isl',
              resolved: true,
              moduleType: 'stdlib',
            },
          ],
          allResolved: true,
        }),
        // stdlibVersions not provided
      });

      expect(result.verdict).toBe('INCOMPLETE_PROOF');
      expect(result.reason).toContain('Stdlib versions not recorded');
    });

    it('returns PROVEN when stdlib versions are recorded', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 10 }),
        importGraph: createImportGraph(),
        stdlibVersions: createStdlibVersions(),
      });

      expect(result.verdict).toBe('PROVEN');
    });
  });

  describe('Combined fail-closed scenarios', () => {
    it('returns PROVEN when all requirements are met', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'SHIP', score: 100 }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 15, passedTests: 15 }),
        verifyResults: createVerifyResults({
          verdict: 'PROVEN',
          summary: {
            totalClauses: 5,
            provenClauses: 5,
            notProvenClauses: 0,
            unknownClauses: 0,
            violatedClauses: 0,
          },
        }),
        importGraph: createImportGraph({
          allResolved: true,
          unresolvedCount: 0,
        }),
        stdlibVersions: createStdlibVersions(),
      });

      expect(result.verdict).toBe('PROVEN');
      expect(result.details).toContain('✓ Gate: SHIP');
      expect(result.details).toContain('✓ Tests: 15/15 passed');
      expect(result.details).toContain('✓ Verify: PROVEN (5 clauses)');
      expect(result.details).toContain('✓ Imports: 1 resolved');
      expect(result.details).toContain('✓ Stdlib: 1 versions recorded');
    });

    it('returns first failure in priority order (gate > tests > verify > imports)', () => {
      const result = calculateVerdictV2({
        gateResult: createGateResult({ verdict: 'NO_SHIP' }),
        buildResult: createBuildResult({ status: 'pass' }),
        testResult: createTestResult({ totalTests: 0 }),
        verifyResults: createVerifyResults({ verdict: 'VIOLATED' }),
        importGraph: createImportGraph({ allResolved: false }),
      });

      // Gate failure takes priority
      expect(result.verdict).toBe('VIOLATED');
      expect(result.reason).toContain('NO_SHIP');
    });
  });
});

// ============================================================================
// Integration Test: Simulated Bundle Verification
// ============================================================================
// Note: Full verifyProof integration tests are skipped in this file because
// they require @isl-lang/isl-core dependencies. These tests verify the
// calculateVerdictV2 logic directly which is the core fail-closed logic.

describe('calculateVerdictV2 - Integration Scenarios', () => {
  it('simulates success=false when tests == 0 (fail-closed)', () => {
    const result = calculateVerdictV2({
      gateResult: createGateResult({ verdict: 'SHIP' }),
      buildResult: createBuildResult({ status: 'pass' }),
      testResult: createTestResult({
        status: 'no_tests',
        totalTests: 0,
        passedTests: 0,
      }),
    });

    expect(result.verdict).toBe('INCOMPLETE_PROOF');
    expect(result.reason).toContain('testCount = 0');
  });

  it('simulates success=true when all requirements met', () => {
    const result = calculateVerdictV2({
      gateResult: createGateResult({ verdict: 'SHIP' }),
      buildResult: createBuildResult({ status: 'pass' }),
      testResult: createTestResult({
        status: 'pass',
        totalTests: 5,
        passedTests: 5,
      }),
    });

    expect(result.verdict).toBe('PROVEN');
  });

  it('simulates success=false when gate is NO_SHIP', () => {
    const result = calculateVerdictV2({
      gateResult: createGateResult({ 
        verdict: 'NO_SHIP', 
        score: 30, 
        blockers: 5 
      }),
      buildResult: createBuildResult({ status: 'pass' }),
      testResult: createTestResult({ totalTests: 10 }),
    });

    expect(result.verdict).toBe('VIOLATED');
  });

  it('simulates success=false when verify has unknown clauses', () => {
    const result = calculateVerdictV2({
      gateResult: createGateResult({ verdict: 'SHIP' }),
      buildResult: createBuildResult({ status: 'pass' }),
      testResult: createTestResult({ totalTests: 10 }),
      verifyResults: {
        verdict: 'NOT_PROVEN',
        clauses: [
          {
            clauseId: 'clause_1',
            clauseType: 'postcondition',
            status: 'unknown',
            traceIds: [],
          },
        ],
        summary: {
          totalClauses: 1,
          provenClauses: 0,
          notProvenClauses: 0,
          unknownClauses: 1,
          violatedClauses: 0,
        },
        durationMs: 0,
        timestamp: new Date().toISOString(),
      },
    });

    expect(result.verdict).toBe('INCOMPLETE_PROOF');
    expect(result.reason).toContain('unknown');
    expect(result.reason).toContain('fail-closed');
  });

  it('simulates proper fail-closed with all v2 fields', () => {
    const result = calculateVerdictV2({
      gateResult: createGateResult({ verdict: 'SHIP' }),
      buildResult: createBuildResult({ status: 'pass' }),
      testResult: createTestResult({ totalTests: 10, passedTests: 10 }),
      importGraph: createImportGraph({
        allResolved: true,
        unresolvedCount: 0,
      }),
      stdlibVersions: createStdlibVersions(),
      verifyResults: createVerifyResults({ 
        verdict: 'PROVEN',
        summary: {
          totalClauses: 3,
          provenClauses: 3,
          notProvenClauses: 0,
          unknownClauses: 0,
          violatedClauses: 0,
        },
      }),
    });

    expect(result.verdict).toBe('PROVEN');
    expect(result.details).toContain('✓ Gate: SHIP');
    expect(result.details).toContain('✓ Tests: 10/10 passed');
    expect(result.details).toContain('✓ Verify: PROVEN (3 clauses)');
    expect(result.details).toContain('✓ Imports: 1 resolved');
    expect(result.details).toContain('✓ Stdlib: 1 versions recorded');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('handles empty verifyResults gracefully', () => {
    const result = calculateVerdictV2({
      gateResult: createGateResult({ verdict: 'SHIP' }),
      buildResult: createBuildResult({ status: 'pass' }),
      testResult: createTestResult({ totalTests: 5 }),
      // No verifyResults
    });

    expect(result.verdict).toBe('PROVEN');
  });

  it('handles missing importGraph gracefully', () => {
    const result = calculateVerdictV2({
      gateResult: createGateResult({ verdict: 'SHIP' }),
      buildResult: createBuildResult({ status: 'pass' }),
      testResult: createTestResult({ totalTests: 5 }),
      // No importGraph
    });

    expect(result.verdict).toBe('PROVEN');
  });

  it('does not require stdlib versions when no stdlib imports', () => {
    const result = calculateVerdictV2({
      gateResult: createGateResult({ verdict: 'SHIP' }),
      buildResult: createBuildResult({ status: 'pass' }),
      testResult: createTestResult({ totalTests: 5 }),
      importGraph: {
        imports: [
          {
            importPath: './local-module',
            resolvedPath: '/project/local-module.isl',
            resolved: true,
            moduleType: 'local',
          },
        ],
        graphHash: 'local-hash',
        allResolved: true,
        unresolvedCount: 0,
      },
      // No stdlibVersions needed - no stdlib imports
    });

    expect(result.verdict).toBe('PROVEN');
  });
});
