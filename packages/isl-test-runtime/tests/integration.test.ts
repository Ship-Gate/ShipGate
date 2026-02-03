/**
 * Integration Tests for isl verify
 * 
 * These tests verify that:
 * 1. Tests can be executed and produce non-zero results
 * 2. Traces are in the correct format for evaluation
 * 3. Proof bundles are properly generated
 * 4. The harness integrates with isl verify command
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  runLoginTests,
  runLoginTestsWithTraces,
  formatForISLVerify,
  assertTestsExecuted,
  createVitestAdapter,
  type TestSummary,
} from '../src/index.js';

describe('Integration: isl verify', () => {
  let summary: TestSummary;
  let tracesJson: string;

  beforeAll(async () => {
    const result = await runLoginTestsWithTraces({ verbose: false });
    summary = result.summary;
    tracesJson = result.tracesJson;
  });

  describe('Test Execution', () => {
    it('should execute tests (count > 0)', () => {
      expect(summary.total).toBeGreaterThan(0);
      assertTestsExecuted(summary);
    });

    it('should have non-zero tests passed', () => {
      expect(summary.passed).toBeGreaterThan(0);
    });

    it('should cover all required scenarios', () => {
      const scenarios = new Set(summary.results.map(r => r.scenario));
      
      // Required scenarios per the deliverables
      expect(scenarios.has('success')).toBe(true);
      expect(scenarios.has('invalid_credentials')).toBe(true);
      expect(scenarios.has('user_locked')).toBe(true);
    });

    it('should not be scaffold-only (all tests must run)', () => {
      // No tests should have undefined duration (scaffold-only indicator)
      for (const result of summary.results) {
        expect(result.duration).toBeDefined();
        expect(result.duration).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Trace Emission (isl-trace-format)', () => {
    it('should emit traces for each test', () => {
      expect(summary.traces.length).toBe(summary.total);
    });

    it('should have valid trace structure', () => {
      for (const trace of summary.traces) {
        // Required fields per isl-trace-format
        expect(trace.id).toBeDefined();
        expect(trace.name).toBeDefined();
        expect(trace.domain).toBeDefined();
        expect(trace.startTime).toBeDefined();
        expect(trace.correlationId).toBeDefined();
        expect(trace.events).toBeDefined();
        expect(Array.isArray(trace.events)).toBe(true);
      }
    });

    it('should have handler_call events', () => {
      for (const trace of summary.traces) {
        const handlerCalls = trace.events.filter(e => e.kind === 'handler_call');
        expect(handlerCalls.length).toBeGreaterThan(0);
        
        for (const call of handlerCalls) {
          expect(call.handler).toBeDefined();
          expect(call.inputs).toBeDefined();
          expect(call.correlationId).toBeDefined();
        }
      }
    });

    it('should have handler_return events', () => {
      for (const trace of summary.traces) {
        const handlerReturns = trace.events.filter(e => e.kind === 'handler_return');
        expect(handlerReturns.length).toBeGreaterThan(0);
        
        for (const returnEvent of handlerReturns) {
          expect(returnEvent.handler).toBeDefined();
          expect(returnEvent.outputs).toBeDefined();
        }
      }
    });

    it('should have check events for postconditions', () => {
      for (const trace of summary.traces) {
        const checkEvents = trace.events.filter(e => e.kind === 'check');
        expect(checkEvents.length).toBeGreaterThan(0);
        
        for (const check of checkEvents) {
          expect(check.inputs).toBeDefined();
          expect(check.outputs).toBeDefined();
          expect(typeof (check.outputs as { passed?: boolean }).passed).toBe('boolean');
        }
      }
    });

    it('should include metadata in traces', () => {
      for (const trace of summary.traces) {
        expect(trace.metadata).toBeDefined();
        expect(trace.metadata?.testName).toBeDefined();
        expect(trace.metadata?.scenario).toBeDefined();
        expect(typeof trace.metadata?.passed).toBe('boolean');
        expect(typeof trace.metadata?.duration).toBe('number');
      }
    });
  });

  describe('Fixture Store for Adapters', () => {
    it('should export traces as valid JSON', () => {
      expect(() => JSON.parse(tracesJson)).not.toThrow();
    });

    it('should have proper export structure', () => {
      const exported = JSON.parse(tracesJson);
      
      expect(exported.generated).toBeDefined();
      expect(exported.spec).toBe('login.isl');
      expect(exported.domain).toBe('Auth');
      expect(exported.version).toBe('1.0.0');
      expect(exported.traces).toBeDefined();
      expect(exported.summary).toBeDefined();
    });

    it('should build verification result via adapter', () => {
      const adapter = createVitestAdapter();
      const { verificationResult, proofBundle } = adapter.generateReport(
        'login.isl',
        'Auth',
        '1.0.0',
        summary
      );

      expect(verificationResult.specFile).toBe('login.isl');
      expect(verificationResult.domain).toBe('Auth');
      expect(verificationResult.verdict).toBe('VERIFIED');
      expect(verificationResult.testsPassed).toBe(summary.passed);
      expect(verificationResult.evidence.length).toBe(summary.total);

      expect(proofBundle.bundleId).toBeDefined();
      expect(proofBundle.verdict).toBe('PROVEN');
    });
  });

  describe('isl verify Output Format', () => {
    it('should format results for isl verify command', () => {
      const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);

      expect(verifyOutput.passed).toBe(true);
      expect(verifyOutput.testsRun).toBe(summary.total);
      expect(verifyOutput.testsPassed).toBe(summary.passed);
      expect(verifyOutput.testsFailed).toBe(summary.failed);
    });

    it('should generate valid proof bundle', () => {
      const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);

      expect(verifyOutput.proofBundle).toBeDefined();
      expect(verifyOutput.proofBundle.bundleId).toBeDefined();
      expect(verifyOutput.proofBundle.specFile).toBe('login.isl');
      expect(verifyOutput.proofBundle.verdict).toBe('PROVEN');
      expect(verifyOutput.proofBundle.generatedAt).toBeDefined();
    });

    it('should have proper summary format (X passed, Y failed)', () => {
      const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);

      expect(verifyOutput.summary).toMatch(/^\d+ passed, \d+ failed$/);
    });

    it('should show non-zero tests passed (deliverable requirement)', () => {
      const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);

      // This is the key deliverable: isl verify shows non-zero tests passed
      expect(verifyOutput.testsPassed).toBeGreaterThan(0);
      console.log(`\nisl verify output: ${verifyOutput.summary}`);
      console.log(`Proof bundle verdict: ${verifyOutput.proofBundle.verdict}`);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle INVALID_CREDENTIALS correctly', () => {
      const invalidCredResults = summary.results.filter(r => r.scenario === 'invalid_credentials');
      expect(invalidCredResults.length).toBeGreaterThan(0);
      
      for (const result of invalidCredResults) {
        expect(result.passed).toBe(true);
      }
    });

    it('should handle USER_LOCKED correctly', () => {
      const lockedResults = summary.results.filter(r => r.scenario === 'user_locked');
      expect(lockedResults.length).toBeGreaterThan(0);
      
      for (const result of lockedResults) {
        expect(result.passed).toBe(true);
      }
    });
  });
});

describe('Integration: End-to-End Verification', () => {
  it('should complete full verification pipeline', async () => {
    // Step 1: Run tests
    const summary = await runLoginTests();
    assertTestsExecuted(summary);

    // Step 2: Format for isl verify
    const verifyOutput = formatForISLVerify('login.isl', 'Auth', '1.0.0', summary);

    // Step 3: Validate output
    expect(verifyOutput.passed).toBe(true);
    expect(verifyOutput.proofBundle.verdict).toBe('PROVEN');

    // Step 4: Print summary (would be shown by isl verify)
    console.log('\n========================================');
    console.log('ISL VERIFY SIMULATION');
    console.log('========================================');
    console.log(`Spec:    login.isl`);
    console.log(`Domain:  Auth v1.0.0`);
    console.log(`Tests:   ${verifyOutput.summary}`);
    console.log(`Verdict: ${verifyOutput.proofBundle.verdict}`);
    console.log('========================================\n');
  });

  it('should maintain test count invariant (> 0)', async () => {
    // Run multiple times to ensure consistency
    for (let i = 0; i < 3; i++) {
      const summary = await runLoginTests();
      expect(summary.total).toBeGreaterThan(0);
      expect(summary.passed).toBeGreaterThan(0);
    }
  });
});
